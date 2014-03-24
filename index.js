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

var hash = L.hash(map);

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
var ghosts = L.featureGroup().addTo(map);

updateMap();

function updateMap() {
    request(config.host + '_csv', function(err, resp, body) {
        database = dsv.csv.parse(body);
        var featuresDiv = document.getElementById('features');
        featuresDiv.innerHTML = '';
        var nested = nestedDocuments(database);
        map.addLayer(featureLayer);
        featureLayer.clearLayers();
        ghosts.clearLayers();
        Object.keys(nested).forEach(function(id) {
            var row = nested[id][nested[id].length - 1];
            if (!row.geojson) return;
            var gj = JSON.parse(row.geojson);
            var toplayer = L.geoJson(gj).eachLayer(function(l) {
                l._dat = row;
                featureLayer.addLayer(l);
            });
            var latest_row = row;
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
                map.removeLayer(featureLayer);
                removeGhosts();
                ghosts.clearLayers();
                if (ghosts._id == id) {
                    ghosts._id = null;
                    map.addLayer(featureLayer);
                    return;
                }
                var ghostDiv = item.appendChild(document.createElement('div'));
                ghostDiv.className = 'ghost-container';
                ghosts._id = id;
                nested[id].map(function(row, i) {
                    var ghostLink = ghostDiv.appendChild(document.createElement('a'));
                    ghostLink.innerHTML = row._rev;
                    ghostLink.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        ghosts.eachLayer(function(l) {
                            if (l != ghost) ghosts.removeLayer(l);
                        });
                        var revert = confirm('Do you want to revert to this version?');
                        if (!revert) {
                            return updateMap();
                        } else {
                            request.post({
                                url: config.host + row._id,
                                json: xtend({
                                    geojson: JSON.parse(row.geojson),
                                }, {
                                    _id: latest_row._id,
                                    _rev: latest_row._rev
                                })
                            }, function(err, resp, body) {
                                flash('reverted feature');
                                updateMap();
                            });
                        }
                    };
                    var ghost = L.geoJson(JSON.parse(row.geojson))
                        .eachLayer(function(l) {
                            if (i !== nested[id].length - 1 && l.setOpacity) l.setOpacity(0.6);
                        })
                        .addTo(ghosts);
                })
            };
        });
        document.getElementById('meta').innerHTML = Object.keys(nested).length + ' features, ' +
            countArrays(values(nested)) + ' versions';
    });
}

function removeGhosts() {
    var ghostC = document.getElementsByClassName('ghost-container');
    for (var i = 0; i < ghostC.length; i++) {
        ghostC[i].parentNode.removeChild(ghostC[i]);
    }
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
