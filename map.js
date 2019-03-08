// List of all the needed files
var files = [
    "data/state_boundaries_albers.json",
    "data/schools_info.json",
    "data/schools_data.json"
]

// Loading files via promises
Promise.all(files.map(url => fetch(url)
    .then(data => data.json())))
    .then(data => mainMap(data));

function mainMap(data) {
    const [stateShapes, schoolsInfo, schoolsData] = data;

    // Setting up margins
    const margin = {top: 20, left: 20, right: 20, bottom: 20};
    const width = 1200 - margin.left - margin.right;
    const height = 800 - margin.top - margin.bottom;

    // Setting a geographic projection, path, and bounding box
    // Contours must be drawn inside this bbox
    var projection = d3.geoAlbersUsa()
        .fitWidth(width - margin.left - margin.right, stateShapes);

    var path = d3.geoPath(projection);
    var bbox = path.bounds(stateShapes);

    // Setting up the draw area for contours
    var x = d3.scaleLinear()
        .domain([bbox[0][0], bbox[1][0]])
        .range([bbox[0][0], bbox[1][0]]);

    var y = d3.scaleLinear()
        .domain([bbox[0][1], bbox[1][1]])
        .range([bbox[0][1], bbox[1][1]]);

    // Sequential color scalss for contours
    var color = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, 1]);

    // Reprojecting lat/lon school locations into albers
    var schoolsInfoTrans = schoolsInfo.map(function(d) {
        return [d.med_code, d.med_address, projection([d.med_lon, d.med_lat])]
            .flat()
            .filter(function(d) { return d != null; });
        });

    var schoolsDataTrans = schoolsData.map(function(d) {
        return [d.med_school_id, d.geoid, d.docs, projection([d.lon, d.lat])]
            .flat()
            .filter(function(d) { return d != null; });
        });

    // Voronoi function
    //var delaunay = d3.Delaunay
      //  .from(schoolsDataTrans.map(function(d) { return [d[3], d[4]] }))
        //.voronoi([bbox[0][0], bbox[0][1], bbox[1][0], bbox[1][1]]);

    // Creating an svg and appending a map + school locations
    var div = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    var svg = d3.select('.map-container')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    svg.selectAll('.state')
        .data(stateShapes.features).enter()
        .append('path')
        .attr('class', 'state')
        .attr('stroke', 'black')
        .attr('fill', "lightgrey")
        .attr('d', path);

    var drawContours = function(d) {
        div.transition()
            .duration(200)
            .style("opacity", .9);

        div.html(d[1])
            .style("left", width - 400 + "px")
            .style("top", 135 + "px");

        schoolsFiltered = schoolsDataTrans
            .filter(function(x) {return x[0] === d[0] })
            .map(function(d) {return [d[3], d[4], d[2]] });

        var contours = d3.contourDensity()
            .x(function(d) { return x(d[0]); })
            .y(function(d) { return y(d[1]); })
            .weight(function(d) { return d[2]; })
            .size([width, height])
            .bandwidth(4)
            (schoolsFiltered);

        d3.selectAll(".contour").remove();

        svg.insert("g", "g")
            .attr("fill", "none")
            .attr("stroke", "#000")
            .attr("stroke-width", 0)
            .attr("stroke-linejoin", "round")
            .attr("opacity", 0.9)
            .selectAll(".contour")
            .data(contours).enter()
            .append("path")
            .attr('class', 'contour')
            .attr("fill", function(d) { return color(d.value); })
            .attr("d", d3.geoPath())
        };

    svg.selectAll("circle")
        .data(schoolsInfoTrans).enter()
        .append("circle")
        .attr("cx", function(d) { return x(d[2]); })
        .attr("cy", function(d) { return y(d[3]); })
        .attr("r", 5)
        .attr("fill", "slategrey")
        .on("mouseover", function(d) { drawContours(d) });

};
