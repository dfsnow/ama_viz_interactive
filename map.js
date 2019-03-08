// List of all the needed files
var files = [
    "data/state_boundaries_albers.json",
    "data/schools_info.json",
    "data/schools_data.json"
]

// Loading files via promises
Promise.all(files.map(url => fetch(url)
    .then(data => data.json())))
    .then(data => mainMap(data))
    .catch(function(error) {
        console.log(error);
    });

function mainMap(data) {
    const [stateShapes, schoolsInfo, schoolsData] = data;
    const mainDiv = document.getElementById("map-column");

    // Setting up margins, width, and height
    const margin = {top: 20, left: 20, right: 10, bottom: 10};
    const width = mainDiv.clientWidth - margin.left - margin.right;
    const height = mainDiv.clientHeight - margin.top - margin.bottom;

    // Setting the projection and path for drawing states
    // and contours
    var projection = d3.geoAlbersUsa()
        .fitWidth(width - margin.left, stateShapes);

    var path = d3.geoPath(projection);

    var bbox = path.bounds(stateShapes)
    var bbox = {
        xmin: bbox[0][0], xmax: bbox[1][0],
        ymin: bbox[0][1], ymax: bbox[1][1]
    };

    // Reprojecting lat/lon school locations into albers
    var schoolsInfoTrans = schoolsInfo.map(function(d) {
        var locs = projection([d.med_lon, d.med_lat])
            .flat()
            .filter(function(d) { return d != null; });

        return {
            school_code: d.med_code,
            school_name: d.med_school_name,
            lon: locs[0],
            lat: locs[1]
        };
    });

    var schoolsDataTrans = schoolsData.map(function(d) {
        var locs = [projection([d.lon, d.lat]), 1]
            .flat()
            .filter(function(d) { return d != null; });

        return {
            school_code: d.med_code,
            geoid: d.geoid,
            n_docs: d.docs,
            lon: locs[0],
            lat: locs[1]
        }
    });

    // Setting up the scales/draw area for contours
    var x = d3.scaleLinear()
        .domain([bbox.xmin, bbox.xmax])
        .range([bbox.xmin, bbox.xmax]);

    var y = d3.scaleLinear()
        .domain([bbox.ymin, bbox.ymax])
        .range([bbox.ymin, bbox.ymax]);

    // Sequential color scales for contours
    var contourColor = d3.scaleSequential(d3.interpolateViridis)
        .domain([0, 1]);

    // Delaunay function for creating voronoi selection
    var delaunay = d3.Delaunay
        .from(schoolsInfoTrans.map(function(d) { return [d.lon, d.lat] }))

    // Creating a temporary div to put the school name into
    var div = d3.select("#info-container")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 1);

    // Creating an svg and appending a map + school locations
    var svg = d3.select('.map-container')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Appending the states as static background
    svg.selectAll('.state')
        .data(stateShapes.features)
        .join('path')
        .attr('class', 'state')
        .attr('stroke', 'black')
        .attr('fill', "lightgrey")
        .attr('d', path);


    // Initialize a set to hold all selected medical schools
    var medSchoolSet = new Set();

    // Function which draws contours based on a medical school id
    // as an input, adds to set of schools until cleared
    var drawContours = function(d) {

        // Append new values to set of schools
        medSchoolSet.add(d.school_code);

        // Return only the students from selected med schools
        schoolsFiltered = schoolsDataTrans
            .filter(function(x) { return medSchoolSet.has(x.school_code) })
            .map(function(d) {
                return {
                    lon: d.lon,
                    lat: d.lat,
                    weight: d.n_docs
                }
            });

        // Draw the contours on the X Y plane of the svg
        var contours = d3.contourDensity()
            .x(function(d) { return x(d.lon); })
            .y(function(d) { return y(d.lat); })
            .weight(function(d) { return d.weight; })
            .size([width, height])
            .bandwidth(4)
            (schoolsFiltered);

        //d3.selectAll(".contour").remove();

        // Join the contours to the SVG
        svg.selectAll(".contour")
            .data(contours)
            .join("path")
            .attr('class', 'contour')
            .attr("fill", function(d) { return contourColor(d.value); })
            .attr("d", d3.geoPath());
    };


    // Function that finds and highlights nearest point
    var mouseMoveHandler = function() {
        const [mx, my] = d3.mouse(this);
        const highlight_point = schoolsInfoTrans[delaunay.find(mx, my)];

        d3.select(this).style("cursor", "pointer");

        div.html(highlight_point.school_name);
        svg.selectAll(".circle-highlight")
            .attr("class", "circle-highlight")
            .attr("cx", highlight_point.lon)
            .attr("cy", highlight_point.lat)
            .style("fill", "red")
    };


    // Function that draws contours of nearest point on click
    var mouseClickHandler = function() {
        const [mx, my] = d3.mouse(this);
        const point = delaunay.find(mx, my);

        drawContours(schoolsInfoTrans[point]);
    };


    // Draw all schools on the map
    svg.selectAll("circle")
        .data(schoolsInfoTrans)
        .join("circle")
        .attr("cx", function(d) { return x(d.lon); })
        .attr("cy", function(d) { return y(d.lat); })
        .attr("r", 4)
        .attr("fill", "slategrey")

    // Draw an arbitrary highlight circle to move to nearest school
    svg.append('circle')
        .attr('class', 'circle-highlight')
        .attr('r', 6)
        .style('fill', 'none');

    // Draw a rectangle overlay to detect mouse movement
    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "black")
        .style("opacity", 0)
        .on("mousemove", mouseMoveHandler)
        .on("click", mouseClickHandler);
        //.on("mouse", function(d) { drawContours(d) });

};

// Suggestions from Alex
// - Searchable style dropdown, html box, populated from d3
// - when click add box to list
// - drag out selected boxes or deselect on click again
// - Lasso brush selection
// - Add note cueing to lasso
// - Select presets (coasts, midwest, rural, DO)

// TODO
// Make points permanent on click
// Add school statistics to sidebar
// Better contour colors
// transitions?
// fix Hawaii
// add search
//
