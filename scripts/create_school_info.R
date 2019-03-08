library(tidyverse)
library(tidycensus)
library(ggmap)
library(sf)
library(jsonlite)

# Load the med school file provided by the AMA
codes <- read_csv("~/work/ama/data/access_med_cleaned_2015_20180905.csv") %>%
  left_join(fips_codes %>% distinct(state_name, state_code), by = c("med_state" = "state_code"))

# Load the wiki table with manually matched codes
schools <- read_csv("./data/wiki_med_schools.csv") %>%
  mutate(med_code = str_pad(med_code, 5, "left", "0"))

# Merge the two tables by code
merged <- left_join(schools, codes, by = "med_code") 

# For all schools with incorrect matching or no code, geocode their address
missing <- merged %>%
  filter(is.na(med_code) | (state_name != med_state_name)) %>%
  mutate_at(
    vars(med_address, med_lost_school:state_name),
    funs(replace(., !is.na(.), NA))
  ) %>%
  mutate(med_address = paste(
    med_school_name,
    med_state_name,
    med_city,
    sep = ", ")
  ) %>%
  mutate_geocode(med_address) %>%
  mutate(med_lon = lon, med_lat = lat) %>%
  select(-lon, -lat)

# Load all US census tracts
tracts <- reduce(
  map(unique(fips_codes$state)[1:51], function(x) {
    get_acs(geography = "tract", variables = "B01001_001", 
            state = x, year = 2017, geometry = TRUE)
  }), 
  rbind
)

# Get the census tract containing the medical school
missing <- missing %>%
  st_as_sf(coords = c("med_lon", "med_lat"), remove = FALSE, crs = 4326) %>%
  st_join(tracts %>% select(GEOID) %>% st_transform(4326), join = st_within) %>%
  mutate(
    med_state = str_sub(GEOID, 1, 2),
    med_county = str_sub(GEOID, 3, 5),
    med_tract = str_sub(GEOID, 6, 11),
    med_geoid = GEOID
  ) %>%
  select(-state_name, -GEOID) %>%
  left_join(
    fips_codes %>% distinct(state_code, state_name),
    by = c("med_state" = "state_code")
  ) %>%
  st_set_geometry(NULL)

# Merge missing back to original data, reorder columns, then save
final <- merged %>% 
  filter(!is.na(med_code) & state_name == med_state_name) %>%
  bind_rows(missing) %>%
  select(med_code, med_school_name, med_city, med_state_name, everything()) %>%
  select(-state_name, -med_match, -med_lost_school) 

# Load the AMA data for attaching calculated values to med schools
source("scripts/load_ama_data.R")
source("scripts/load_geo_functions.R")

# Load a list of AMA primary care codes
primary_care_codes <- c(
  "ADL", "AMF", "AMI", "FMP", "FP", "FPG",
  "GP", "GPM", "IM", "IMG", "IPM", "MPD", "PD")

# Get the count of specialists and primary care docs per school
schools_counts <- ama_filtered %>%
  filter(!is.na(geoid) & med_school_id %in% final$med_code) %>%
  group_by(med_school_id) %>%
  summarize(
    med_n_primary = sum(primary_specialty %in% primary_care_codes),
    med_n_specialty = sum(!primary_specialty %in% primary_care_codes)
  ) %>%
  ungroup() 

final %>% left_join(
  schools_counts,
  by = c("med_code" = "med_school_id")) %>% 
  write_csv("data/schools_info_raw.csv")
  

