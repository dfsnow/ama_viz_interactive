# Code for eliding taken from the albersusa package
access_ak_bb <- readRDS(system.file("extdata/alaska_bb.rda", package="albersusa"))
access_ak_poly <- as(raster::extent(as.vector(t(access_ak_bb))), "SpatialPolygons") 
sp::proj4string(access_ak_poly) <- "+proj=laea +lat_0=45 +lon_0=-100 +x_0=0 +y_0=0 +a=6370997 +b=6370997 +units=m +no_defs"
access_ak_poly <- access_ak_poly %>% st_as_sf()

access_hi_bb <- readRDS(system.file("extdata/hawaii_bb.rda", package="albersusa"))
access_hi_poly <- as(raster::extent(as.vector(t(access_hi_bb))), "SpatialPolygons")
sp::proj4string(access_hi_poly) <- "+proj=laea +lat_0=45 +lon_0=-100 +x_0=0 +y_0=0 +a=6370997 +b=6370997 +units=m +no_defs"
access_hi_poly <- access_hi_poly %>% st_as_sf()

rm(list = c("access_ak_bb", "access_hi_bb"))

# Function to retrive coordinates from geometry col
sfc_as_cols <- function(x, names = c("x","y")) {
  stopifnot(inherits(x,"sf") && inherits(sf::st_geometry(x),"sfc_POINT"))
  ret <- sf::st_coordinates(x)
  ret <- tibble::as_tibble(ret)
  stopifnot(length(names) == ncol(ret))
  x <- x[ , !names(x) %in% names]
  ret <- setNames(ret,names)
  dplyr::bind_cols(x,ret)
}