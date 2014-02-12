var request = require('browser-request'),
    xtend = require('xtend'),
    dsv = require('dsv'),
    config = require('./config.json');

var map = L.mapbox.map('map', 'tmcw.h8einhmh', {
    tileLayer: {
        detectRetina: true
    },
    infoControl: false,
    zoomControl: false
});

var featureLayer = L.featureGroup().addTo(map);

var drawControl = new L.Control.Draw({
    edit: { featureGroup: featureLayer },
    draw: {
        circle: false,
        polyline: { metric: navigator.language !== 'en-US' },
        polygon: { metric: navigator.language !== 'en-US' }
    }
}).addTo(map);

map
    .on('draw:edited', update)
    .on('draw:deleted', update)
    .on('draw:created', created);

var database = [];
var ghosts;

updateMap();

function updateMap() {
    request(config.host + '_csv', function(err, resp, body) {
        database = dsv.csv.parse(body);
        var featuresDiv = document.getElementById('features');
        featuresDiv.innerHTML = '';
        var nested = nestedDocuments(database);
        featureLayer.clearLayers();
        Object.keys(nested).forEach(function(id) {
            var row = nested[id].pop();
            var gj = JSON.parse(row.geojson);
            var toplayer = L.geoJson(gj).eachLayer(function(l) {
                l._dat = row;
                featureLayer.addLayer(l);
            });
            var item = featuresDiv.appendChild(document.createElement('div'));
            item.className = 'feature-item rel';

            var zoomLink = item.appendChild(document.createElement('a'));
            zoomLink.href = '#';
            zoomLink.innerHTML = gj.geometry.type;
            zoomLink.onclick = function() {
                map.fitBounds(toplayer.getBounds());
            };

            var versionLink = item.appendChild(document.createElement('a'));
            versionLink.href = '#';
            versionLink.className = 'versions-link';
            versionLink.innerHTML = nested[id].length + ' versions';
            versionLink.onclick = function() {
                ghostDiv.innerHTML = '';
                ghostDiv.classList.remove('show');
                if (ghosts && map.hasLayer(ghosts)) {
                    map.removeLayer(ghosts);
                    if (ghosts._id == id) return;
                }
                ghostDiv.classList.add('show');
                ghosts = L.geoJson(nested[id].map(function(row) {
                    var ghostLink = ghostDiv.appendChild(document.createElement('a'));
                    ghostLink.innerHTML = row._id;
                    return JSON.parse(row.geojson) }))
                    .eachLayer(function(l) {
                        if (l.setOpacity) l.setOpacity(0.6);
                    })
                    .addTo(map);
               ghosts._id = id;
            };

            var ghostDiv = item.appendChild(document.createElement('div'));
            ghostDiv.className = 'ghost-container';
        });
        var nested = nestedDocuments(database);
        document.getElementById('meta').innerHTML = Object.keys(nested).length + ' features, ' +
            '<a href="#" id="versions">' + countArrays(values(nested)) + ' versions</a>';
    });
}

function countArrays(l) {
    return l.reduce(function(mem, a) {
        return mem + a.length;
    }, 0);
}

function values(o) {
    return Object.keys(o).map(function(k) {
        return o[k];
    });
}

function nestedDocuments(database) {
    var docs = {};
    for (var i = 0; i < database.length; i++) {
        if (!docs[database[i]._id]) docs[database[i]._id] = [];
        docs[database[i]._id].push(database[i]);
    }
    return docs;
}

function allDocuments(database) {
    var nested = nestedDocuments(database);
    var l = [];
    for (var id in nested) {
        l = l.concat(nested[id]);
    }
    return l;
}

function latestDocuments(database) {
    var nested = nestedDocuments(database);
    var l = [];
    for (var id in nested) {
        l.push(nested[id].pop());
    }
    return l;
}

function update(e) {
    e.layers.eachLayer(function(layer) {
        var geojson = layer.toGeoJSON();
        request.post({
            url: config.host + layer._dat._id,
            json: xtend({
                geojson: geojson,
            }, {
                _id: layer._dat._id,
                _rev: layer._dat._rev
            })
        }, function(err, resp, body) {
            layer._dat = body;
            flash('updated feature');
            updateMap();
        });
    });
}

function created(e) {
    var geojson = e.layer.toGeoJSON();
    request.post({
        url: config.host,
        json: {
            geojson: geojson
        }
    }, function(err, resp, body) {
        e.layer._dat = body;
        featureLayer.addLayer(e.layer);
        flash('saved new feature');
        updateMap();
    });
}

function flash(_) {
    document.getElementById('flash').innerHTML = _;
    document.getElementById('flash').classList.add('show');
    setTimeout(function() {
        document.getElementById('flash').classList.remove('show');
    }, 1000);
}
