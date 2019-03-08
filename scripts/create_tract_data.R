library(tidyverse)
library(jsonlite)
library(sf)
library(tigris)

# Load the raw AMA dataset
source("scripts/load_ama_data.R")
source("scripts/load_geo_functions.R")

# Load a list of all medical schools
schools_info <- read_csv("data/schools_info_raw.csv") %>%
  filter(!is.na(med_code) & (med_n_primary + med_n_specialty) >= 1000)

schools_info %>% write_json("data/schools_info.json")

# Get the number of each doctors from each school at each tract
schools_data <- ama_filtered %>%
  filter(!is.na(geoid) & med_school_id %in% schools_info$med_code) %>%
  mutate(geoid = paste0(fips_state, fips_county)) %>%
  group_by(med_school_id, geoid) %>%
  summarize(docs = n()) %>%
  ungroup() %>%
  filter(docs > 3) %>%
  rename(med_code = med_school_id)

# Load pop-weighted US census tracts
counties <- read_csv("data/county_centroids_raw.csv") %>%
  mutate(geoid = str_pad(geoid, 5, "left", "0")) %>%
  filter(geoid %in% schools_data$geoid) %>%
  st_as_sf(coords = c("lon", "lat"), crs = 4326) %>%
  as_Spatial() %>%
  albersusa::points_elided() %>%
  st_as_sf() %>%
  st_transform(2163) %>%
  mutate(
    hi_int = lengths(st_intersects(., access_hi_poly)) > 0,
    ak_int = lengths(st_intersects(., access_ak_poly)) > 0
  ) %>%
  filter(!ak_int & !hi_int) %>%
  select(geoid) %>%
  st_transform(4326) %>%
  sfc_as_cols(names = c("lon", "lat")) %>%
  st_set_geometry(NULL) 

schools_data %>%
  left_join(counties, by = "geoid") %>%
  filter(!is.na(lon)) %>%
  write_json("data/schools_data.json")

# Load an albers state map with Alaska and Hawaii translated
states <- tigris::states(cb = TRUE, resolution = "20m", year = 2017) %>%
  albersusa::points_elided() %>%
  st_as_sf() %>%
  st_transform(2163) %>%
  mutate(
    hi_int = lengths(st_intersects(., access_hi_poly)) > 0,
    ak_int = lengths(st_intersects(., access_ak_poly)) > 0
  ) %>%
  filter(!ak_int & !hi_int) %>%
  set_names(snakecase::to_snake_case(colnames(.))) %>%
  filter(!geoid %in% c("72")) %>%
  st_transform(4326) %>%
  select(geoid) %>%
  st_write("data/state_boundaries_albers.geojson")

file.rename(
  from = "data/state_boundaries_albers.geojson",
  to = "data/state_boundaries_albers.json")
