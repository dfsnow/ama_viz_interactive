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


// Initialize a set to hold all selected medical schools
var medSchoolSet = new Set();

// Main map drawing function
var mainMap = function(data) {
    const [stateShapes, schoolsInfo, schoolsData] = data;

    // Setting up all main global elements
    const mainDiv = document.getElementById("map-column");

    // Setting up margins, width, and height
    const margin = {top: 20, left: 20, right: 0, bottom: 0};
    const width = mainDiv.clientWidth - margin.left - margin.right;
    const height = mainDiv.clientHeight - margin.top - margin.bottom;

    // Sequential color scales for contours
    var amaColors = [
        '#2a044a','#31325d',
        '#44546f','#5b7781',
        '#759c92', '#e7d5c0',
        '#f2b6a8','#f99591',
        '#fd717a','#fe4365'
    ]

    var contourColor = d3.scaleLinear()
        .domain([0,1,2,3,4,5,6,7,8,9])
        .interpolate(d3.interpolateRgb)
        .range(amaColors)

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

    // Setting up the scales/draw area for contours
    var x = d3.scaleLinear()
        .domain([bbox.xmin, bbox.xmax])
        .range([bbox.xmin, bbox.xmax]);

    var y = d3.scaleLinear()
        .domain([bbox.ymin, bbox.ymax])
        .range([bbox.ymin, bbox.ymax]);

    // Reprojecting lat/lon school locations into albers
    var schoolsInfoTrans = schoolsInfo.map(function(d) {
        var locs = projection([d.med_lon, d.med_lat])
            .flat()
            .filter(function(d) { return d != null; });

        return {
            med_school_name: d.med_school_name,
            lon: locs[0],
            lat: locs[1]
        };
    });

    var schoolsDataTrans = schoolsData.map(function(d) {
        var locs = [projection([d.lon, d.lat]), 1]
            .flat()
            .filter(function(d) { return d != null; });

        return {
            med_school_name: d.med_school_name,
            geoid: d.geoid,
            n_docs: d.docs,
            lon: locs[0],
            lat: locs[1]
        }
    });

    var medSchoolNames = schoolsDataTrans.map(d => d.med_school_name)

    // Creating an svg and appending a map + school locations
    var svg = d3.select('#map-container')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);

    // Creating a temporary div to put the school name into
    var div = d3.select("#map-tooltip")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 1);

    // Appending the states as static background
    svg.selectAll('.state')
        .data(stateShapes.features)
        .join('path')
        .attr('class', 'state')
        .attr('stroke', 'black')
        .attr('fill', "lightgrey")
        .attr('d', path);

    // Append school options to search box datalist
    d3.select('#medDataList')
        .selectAll('option')
        .data(schoolsInfo)
        .join('option')
        .attr('value', function(d) { return d.med_school_name; });


    // Function that finds and highlights nearest point
    var mouseMoveHandler = function() {
        const [mx, my] = d3.mouse(this);
        const highlight_point = schoolsInfoTrans[delaunay.find(mx, my)];

        div.html(highlight_point.med_school_name);
        svg.selectAll(".circle-highlight")
            .attr("class", "circle-highlight")
            .attr("cx", highlight_point.lon)
            .attr("cy", highlight_point.lat)
            .style("fill", "red")
    };


    // Function that draws contours of nearest point on click
    var mouseClickHandler = function() {
        const [mx, my] = d3.mouse(this);
        const point = schoolsInfoTrans[delaunay.find(mx, my)].med_school_name;

        if (medSchoolSet.has(point)) {
            medSchoolSet.delete(point);
        } else {
            medSchoolSet.add(point);
        };

        medListHandler(medSchoolSet);
        drawContours(medSchoolSet);
    };


    // Function which draws contours based on a medical school id
    // as an input, adds to set of schools until cleared
    var drawContours = function(set) {

        // Return only the students from selected med schools
        schoolsFiltered = schoolsDataTrans
            .filter(function(x) { return set.has(x.med_school_name) })
            .map(function(d) {
                return {
                    lon: d.lon,
                    lat: d.lat,
                    weight: d.n_docs
                }
            });

        // Draw the contours on the X Y plane of the svg
        var contours = d3.contourDensity()
            .x(function(d) { return d.lon; })
            .y(function(d) { return d.lat; })
            .weight(function(d) { return d.weight; })
            .size([width, height])
            .bandwidth(4)
            (schoolsFiltered);

        // Join the contours to the SVG
        svg.selectAll(".contour")
            .data(contours)
            .join("path")
            .attr('class', 'contour')
            .attr("fill", function(d) { return contourColor(d.value); })
            .style("cursor", "pointer")
            .attr("d", d3.geoPath());

        svg.selectAll("overlay").remove();

        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "black")
            .style("opacity", 0)
            .style("cursor", "pointer")
            .on("mousemove", mouseMoveHandler)
            .on("click", mouseClickHandler);
    };


    // Draw all schools on the map
    svg.selectAll("circle")
        .data(schoolsInfoTrans)
        .join("circle")
        .attr("cx", function(d) { return x(d.lon); })
        .attr("cy", function(d) { return y(d.lat); })
        .attr("r", 4)
        .attr("fill", "#6386b7")

    // Draw an arbitrary highlight circle to move to nearest school
    svg.append('circle')
        .attr('class', 'circle-highlight')
        .attr('r', 6)
        .style('fill', 'none');

    // Delaunay function for creating voronoi selection
    var delaunay = d3.Delaunay
        .from(schoolsInfoTrans.map(function(d) { return [d.lon, d.lat] }))

    // Draw a rectangle overlay to detect mouse movement
    svg.append("rect")
        .attr("class", "overlay")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "black")
        .style("opacity", 0)
        .style("cursor", "pointer")
        .on("mousemove", mouseMoveHandler)
        .on("click", mouseClickHandler);

    // Create a searchbar in the information div
    d3.select("#medSearchForm").on("submit", function() {
        medSearchHandler();
        document.getElementById('medSearchForm').reset()
    });

    d3.select("#medClearAll")
        .style("cursor", "pointer")
        .on("click", function() {
            medSchoolSet.clear();
            drawContours(medSchoolSet);
            medListHandler(medSchoolSet);
        });


    // Creating a handler for the search box
    var medSearchHandler = function() {
        let searchValue = document.getElementById("medSearchInput").value
        medValueChecker(searchValue);
    };

    var medListHandler = function(set) {
        listValues = Array.from(set);
        d3.select("#info-schools-list").select("ul").append("li");
        d3.select("#info-schools-list").selectAll("li")
            .data(listValues)
            .join('text')
            .attr("class", "school")
            .text(function(d) { return d; })
            .style("cursor", "pointer")
            .on("click", function(d) {
                medSchoolSet.delete(d);
                drawContours(medSchoolSet);
                medListHandler(medSchoolSet);
            });

    };

    var medValueChecker = function(school) {
        // If value is in schools set delete, if not, append to set
        if (medSchoolSet.has(school)) {
            medSchoolSet.delete(school);
            drawContours(medSchoolSet);
            medListHandler(medSchoolSet);
        } else {
            if (medSchoolNames.includes(school)) {
                medSchoolSet.add(school);
                drawContours(medSchoolSet);
                medListHandler(medSchoolSet);
            };
        };
    };

    d3.select("#medSetMostUrban")
        .style("cursor", "pointer")
        .on("click", function() {
        [   "University of California, Irvine School of Medicine",
            "State University of New York Upstate Medical University",
            "Albert Einstein College of Medicine",
            "New York University School of Medicine",
            "Stony Brook University School of Medicine"
        ].forEach(function(d) {
            medSchoolSet.add(d)
            drawContours(medSchoolSet);
            medListHandler(medSchoolSet);
        });
    });

    d3.select("#medSetMostRural")
        .style("cursor", "pointer")
        .on("click", function() {
        [   "University of Mississippi School of Medicine",
            "University of Arkansas for Medical Sciences/UAMS College of Medicine",
            "West Virginia University School of Medicine",
            "Louisiana State University School of Medicine in Shreveport",
            "University of Iowa Roy J. and Lucille A. Carver College of Medicine"
        ].forEach(function(d) {
            medSchoolSet.add(d)
            drawContours(medSchoolSet);
            medListHandler(medSchoolSet);
        });
    });

    d3.select("#medSetTop10")
        .style("cursor", "pointer")
        .on("click", function() {
        [   "Harvard Medical School",
            "Johns Hopkins University School of Medicine",
            "New York University School of Medicine",
            "Stanford University School of Medicine",
            "UCSF School of Medicine",
            "Mayo Clinic College of Medicine",
            "Perelman School of Medicine at the University of Pennsylvania",
            "David Geffen School of Medicine at UCLA",
            "Washington University School of Medicine",
            "Duke University School of Medicine"
        ].forEach(function(d) {
            medSchoolSet.add(d)
            drawContours(medSchoolSet);
            medListHandler(medSchoolSet);
        });
    });


};


// Suggestions from Alex
// - Lasso brush selection
// - Add note cueing to lasso

// TODO
// transitions?
// fix Hawaii
