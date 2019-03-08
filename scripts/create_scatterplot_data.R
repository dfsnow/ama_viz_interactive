library(tidyverse)
library(jsonlite)

spec_primary_care_codes <- c(
  "ADL", "AMF", "AMI", "FMP", "FP", "FPG",
  "GP", "GPM", "IM", "IMG", "IPM", "MPD", "PD")

med_data <- ama_filtered %>%
  mutate(
    num_gp = ifelse(primary_specialty %in% spec_primary_care_codes, 1, 0),
    urban_school = ifelse(med_qcbsa >= 5, 1, 0)
  ) %>% 
  group_by(med_school_id, med_address) %>%
  summarize(
    student_count = n(),
    avg_score = mean(med_mcat_score, na.rm = T),
    urban_school = mean(urban_school, na.rm = T),
    pct_gp = sum(num_gp) / n()
  ) %>%
  filter(!is.na(med_address) & student_count >= 1000) %>%
  arrange(-avg_score) %>%
  filter(avg_score >= 514) %>%
  ungroup() %>%
  select(-med_school_id) %>%
  write_json("data/med_data_scatterplot_subset.json")


