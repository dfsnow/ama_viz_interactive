///////////////////////////////////////////////////////
/////////  LOADING DATA                       /////////
///////////////////////////////////////////////////////

// List of all the needed files
var files = [
    "data/state_boundaries_albers.json",
    "data/schools_info.json",
    "data/schools_data.json",
    "data/schools_presets.json",
    "data/lasso_data.json"
]

// Loading files via promises
Promise.all(files.map(url => fetch(url)
    .then(data => data.json())))
    .then(data => mainMap(data))
    .catch(function(error) {
        console.log(error);
        d3.text("error.txt").then(function(text) {
            console.log(text);
            document.getElementById("info-schools-list").innerHTML =
            "There was an error loading the map, please check the console";
        });
    });


///////////////////////////////////////////////////////
/////////  SETTING UP GLOBALS                 /////////
///////////////////////////////////////////////////////

// Setting up all main global elements
const mainDiv = document.getElementById("map-column");
const propPlotWidth = document.getElementById('info-schools-sumstats').clientWidth

// Setting up margins, width, and height
const margin = {top: 20, left: 20, right: 0, bottom: 20};
const width = mainDiv.clientWidth - margin.left - margin.right;
const height = mainDiv.clientHeight - margin.top - margin.bottom;

// Initialize a set to hold all selected medical schools
var medSchoolSet = new Set();

// Main map drawing function
var mainMap = function(data) {
    const [stateShapes, schoolsInfo, schoolsData, schoolsPresets, lassoData] = data;

    // Sequential color scales for contours
    const domainThresholds = [0,2,4,6,8,10,12,14,16,18]
    var amaColors = [
        '#2a044a','#31325d',
        '#44546f','#5b7781',
        '#759c92', '#e7d5c0',
        '#f2b6a8','#f99591',
        '#fd717a','#fe4365'
    ]

    var contourColor = d3.scaleLinear()
        .domain(domainThresholds)
        .range(amaColors)

    // Setting the projection and path for drawing states
    // and contours
    var projection = d3.geoAlbers()
        .fitSize([width, height], stateShapes);

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


    ///////////////////////////////////////////////////////
    /////////  REPROJECTING GEODATA               /////////
    ///////////////////////////////////////////////////////

    // Reprojecting lat/lon school locations into albers
    var schoolsInfoTrans = schoolsInfo.map(function(d) {
        var locs = projection([d.med_lon, d.med_lat])
            .flat()
            .filter(function(d) { return d != null; });

        return {
            med_school_name: d.med_school_name,
            med_est: d.med_est,
            med_degree: d.med_degree,
            med_n_primary: d.med_n_primary,
            med_n_specialty: d.med_n_specialty,
            med_mcat_score: d.med_mcat_score,
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

    var medSchoolNames = schoolsInfoTrans.map(d => d.med_school_name)


    ///////////////////////////////////////////////////////
    /////////  CREATING STATIC PLOT ELEMENTS      /////////
    ///////////////////////////////////////////////////////

    // Creating an svg and appending a map + school locations
    var svg = d3.select('#map-container')
        .attr('width', width)
        .attr('height', height + margin.top)
        .append('g')
        .attr('transform', `translate(0, ${margin.top})`);

    // Svg for containing mini proportion plot
    var propPlot = d3.select("#info-schools-plot")
        .append('svg')
        .append("g");

    propPlot.append("rect")
        .attr("width", propPlotWidth + "px")
        .attr("height", "40px")
        .attr("fill", "#31325d");

    propPlot.append("rect")
        .attr("class", "info-schools-plot")
        .attr("width", propPlotWidth + "px")
        .attr("height", "40px")
        .attr("fill", "#31325d");

    // Creating a temporary div to put the school name into
    var div = d3.select("#map-tooltip")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 1)
        .style("line-height", 1.5);

    // Appending the states as static background
    svg.selectAll('.state')
        .data(stateShapes.features)
        .join('path')
        .attr('class', 'state')
        .attr('stroke', 'black')
        .attr('fill', "lightgrey")
        .attr('d', path);

    // Adding a color legend to the map svg
    svg.append("g")
        .attr("class", "colorLegend")
        .attr("transform", `translate(
            ${x.range()[1] / 3 * 1.7},
            ${y.range()[1] / 3 * 2.7})`
        );

    var colorLegend = d3.legendColor()
        .shapeWidth(x.range()[1] / 50)
        .titleWidth(x.range()[1] / 4)
        .shapePadding(0)
        .cells(10)
        .labels(["Low", Array(8).fill(""), "High"].flat())
        .orient('horizontal')
        .title("Graduate Practice Density")
        .scale(contourColor);

    svg.select(".colorLegend")
        .call(colorLegend);

    // Append school options to search box datalist
    d3.select('#medDataList')
        .selectAll('option')
        .data(schoolsInfo)
        .join('option')
        .attr('value', function(d) { return d.med_school_name; });

    // Draw all schools on the map
    var schoolCircles = svg.selectAll("circle")
        .data(schoolsInfoTrans)
        .join("circle")
        .attr("cx", function(d) { return d.lon; })
        .attr("cy", function(d) { return d.lat; })
        .attr("r", 4)
        .attr("fill", "#6386b7")

    // Delaunay function for creating voronoi selection
    var delaunay = d3.Delaunay
        .from(schoolsInfoTrans.map(function(d) { return [d.lon, d.lat] }))

    // Create a searchbar in the information div
    d3.select("#medSearchForm").on("submit", function() {
        let searchValue = document.getElementById("medSearchInput").value;
        medValueChecker(searchValue);
        document.getElementById('medSearchForm').reset();
    });

    // Setting actions for the clear all button
    d3.select("#medClearAll")
        .style("cursor", "pointer")
        .on("click", function() {
            medSchoolSet.clear();
            drawContours(medSchoolSet);
            medListHandler(medSchoolSet);
        });


    ///////////////////////////////////////////////////////
    /////////  CREATING HANDLER FUNCTIONS         /////////
    ///////////////////////////////////////////////////////

    // Function that finds and highlights nearest point to cursor
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


    // Updates the list of shown med school under the searchbar
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


    // Checks if a school value is within the allowable set
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


    ///////////////////////////////////////////////////////
    /////////  MAIN CONTOUR DRAWING FUNCTION      /////////
    ///////////////////////////////////////////////////////

    // Function which draws contours based on a medical school id
    // as an input, adds to set of schools until cleared
    var drawContours = function(set) {

        // Remove introductory tips
        d3.select("#info-intro-tip").remove();
        d3.selectAll(".lasso-helper")
            .transition()
            .duration(500)
            .attr("opacity", 0)
            .remove();

        // Return only the students and information from selected med schools
        schoolsDataFiltered = schoolsDataTrans
            .filter(function(x) { return set.has(x.med_school_name) })
            .map(function(d) {
                return {
                    lon: d.lon,
                    lat: d.lat,
                    weight: d.n_docs
                }
            });

        schoolsInfoFiltered = schoolsInfoTrans
            .filter(function(x) { return set.has(x.med_school_name) })
            .map(function(d) {
                return {
                    med_n_primary: d.med_n_primary,
                    med_n_specialty: d.med_n_specialty,
                    med_mcat_score: d.med_mcat_score
                }
            });

        // Draw the contours on the X Y plane of the svg
        var contours = d3.contourDensity()
            .x(function(d) { return d.lon; })
            .y(function(d) { return d.lat; })
            .weight(function(d) { return d.weight; })
            .size([width, height])
            .bandwidth(4)
            (schoolsDataFiltered);

        // Join the contours to the SVG
        svg.selectAll(".contour")
            .data(contours)
            .join("path")
            .attr('class', 'contour')
            .style("cursor", "pointer")
            .attr("d", d3.geoPath())
            .attr("fill", function(d) { return contourColor(d.value); })

        // Draw an arbitrary highlight circle to move to nearest school
        svg.append('circle')
            .attr('class', 'circle-highlight')
            .attr('r', 6)
            .style('fill', 'none');

        // Draw a background overlay for point tracking
        svg.append("rect")
            .attr("class", "overlay")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "black")
            .style("opacity", 0)
            .style("cursor", "pointer")
            .on("mousemove", mouseMoveHandler)
            .on("click", mouseClickHandler);

        // Calculate the average MCAT of selected schools
        d3.select("#info-schools-sumstats-mcat p")
            .join("text")
            .html(Math.round(schoolsInfoFiltered
                .map(function(d) { return d.med_mcat_score; })
                .filter(Boolean)
                .reduce((a, b) => a + b, 0) /
                schoolsInfoFiltered
                    .map(function(d) { return d.med_mcat_score; })
                    .filter(Boolean).length
                ) || 0);

        // Get the total number of primary care physicians
        var n_spec = Math.round(schoolsInfoFiltered
            .map(function(d) { return d.med_n_specialty; })
            .reduce((a, b) => a + b, 0));

        // Get the total number of specialists
        var n_prim = Math.round(schoolsInfoFiltered
            .map(function(d) { return d.med_n_primary; })
            .reduce((a, b) => a + b, 0));

        // Join the total number of docs to the summary stats page
        d3.select("#info-schools-sumstats-docs p")
            .join("text")
            .html(+n_spec + +n_prim);

        // Create X scale for proportion plot
        var propPlotScaleX = d3.scaleLinear()
            .domain([0, +n_spec + +n_prim])
            .range([0, propPlotWidth]);

        // Append scaled rects to plot to represent proportion of primary care
        propPlot.selectAll(".info-schools-plot")
            .data([+n_prim])
            .join("rect")
            .transition()
            .duration(300)
            .attr("width", function(d) { return propPlotScaleX(d) + "px"; })
            .attr("height", "40px")
            .style("fill", "#fd717a");

        // Append number of primary care physicians to bar
        propPlot.selectAll(".info-plotstat")
            .data([+n_spec])
            .join("text")
            .attr("text-anchor", "end")
            .attr("x", propPlotWidth - 20 + "px")
            .attr("y", "30px")
            .attr("class", "info-plotstat")
            .text(function(d) { return d; });

        // Append number of primary care physicians to bar
        propPlot.append("text")
            .attr("x", "20px")
            .attr("y", "30px")
            .attr("class", "info-plotstat")
            .text(+n_prim);
    };


    ///////////////////////////////////////////////////////
    /////////  DEFINING PRESET SCHOOL SETS        /////////
    ///////////////////////////////////////////////////////

    // Load all presets from data
    d3.select("#info-schools-subsets")
        .selectAll("input")
        .data(schoolsPresets)
        .enter()
        .append("input")
        .attr("type", "button")
        .attr("class", "medPresetButton")
        .attr("value", function(d) { return d.preset_name; })
        .style("cursor", "pointer")
        .on("click", function(x) {
            medSchoolSet.clear();
            x.schools.forEach(function(d) {
                medSchoolSet.add(d)
                medListHandler(medSchoolSet);
            });
            drawContours(medSchoolSet);
        });

    // Load all schools
    d3.select("#info-schools-subsets")
        .append("input")
        .attr("type", "button")
        .attr("class", "medPresetButton")
        .attr("value", "All")
        .style("cursor", "pointer")
        .on("click", function() {
            medSchoolSet.clear();
            medSchoolNames.forEach(function(d) {
                medSchoolSet.add(d)
                medListHandler(medSchoolSet);
            });
            drawContours(medSchoolSet);
        });


    ///////////////////////////////////////////////////////
    /////////  LASSO SELECTION HANDLING           /////////
    ///////////////////////////////////////////////////////

    var lassoHelperInitializer = function () {

    var lassoDataTrans = lassoData.coordinates.map(function(d) {
        return projection([d[0], d[1]])
    });

    var lassoLine = d3.line()
        .x(function(d) {return x(d[0]);})
        .y(function(d) {return y(d[1]);})
        .curve(d3.curveCardinal.tension(0));

    var lassoPath = svg.append("path")
        .attr("d", lassoLine(lassoDataTrans))
        .attr("class", "lasso-helper")
        .attr("stroke", "#252525")
        .attr("stroke-width", "2")
        .attr("fill", "none");

    var lassoLength = lassoPath.node().getTotalLength();
    var lassoHelperRepeater = function() {
        lassoPath
            .attr("stroke-dasharray", lassoLength + " " + lassoLength)
            .attr("stroke-dashoffset", lassoLength)
            .attr("opacity", 1)
            .transition()
                .duration(2000)
                .attr("stroke-dashoffset", 0)
            .transition()
                .delay(500)
                .duration(500)
                .attr("opacity", 0)
                .on("end", lassoHelperRepeater);
        };

        lassoHelperRepeater();
    };

    // Main lasso functions, taken directly from bl.ocks
    // https://bl.ocks.org/skokenes/a85800be6d89c76c1ca98493ae777572
    var lasso_start = function() {
        lasso.items()
            .classed("not_possible", true)
            .classed("selected", false);
    };

    var lasso_draw = function() {
        lasso.possibleItems()
            .classed("not_possible", false)
            .classed("possible", true);

        lasso.notPossibleItems()
            .classed("not_possible", true)
            .classed("possible", false);
    };

    var lasso_end = function() {
        lasso.items()
            .classed("not_possible", false)
            .classed("possible", false);

        lasso.selectedItems().data().map( function(d) {
            medValueChecker(d.med_school_name);
        });
    };

    var lasso = d3.lasso()
        .closePathSelect(true)
        .closePathDistance(100)
        .items(schoolCircles)
        .targetArea(svg)
        .on("start",lasso_start)
        .on("draw",lasso_draw)
        .on("end",lasso_end);

    svg.call(lasso);


    ///////////////////////////////////////////////////////
    /////////  INITIALIZING FIRST TIME STUFF      /////////
    ///////////////////////////////////////////////////////

    // Initialize contours and highlight circle with empty set
    // Draw intro tip in the list area
    drawContours(medSchoolSet);
    lassoHelperInitializer();
    d3.select("#info-schools-list")
        .append("text")
        .attr("id", "info-intro-tip")
        .html("Click on or lasso some medical schools to see" +
            " where their graduates end up practicing." + "<br><br>" +
            " Urban medical school graduates are more likely to be" +
            " specialists and live on the coasts, while graduates" +
            " from rural schools are more likely to spread to" +
            " surrounding areas. Scroll down for credits... <br><br>" +
            " This project uses aggregated data from the American Medical" +
            " Association Master File. The data is available" +
            " <a href='https://github.com/dfsnow/ama_viz_interactive/tree/master/data'>here</a>." +
            " <br><br>The code for this project is available at my" +
            " <a href='https://github.com/dfsnow/ama_viz_interactive'>GitHub</a>." +
            " <br><br>Inspired by the following bl.ocks: " +
            " <br><a href='https://bl.ocks.org/pbeshai/8008075f9ce771ee8be39e8c38907570'>D3 Lasso</a>" +
            " <br><a href='http://bl.ocks.org/eesur/9910343'>Dynamic Text Fields</a>" +
            " <br><a href='https://bl.ocks.org/Kcnarf/6d5ace3aa9cc1a313d72b810388d1003'>Voronoi Point Picker</a>"

        )




            //

};

