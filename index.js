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

function update(e) {
    e.layers.eachLayer(function(layer) {
        var geojson = layer.toGeoJSON();
        request.post({
            url: config.host,
            json: xtend({
                feature: geojson,
            }, layer._dat)
        }, function(err, resp, body) {
            layer._dat = body;
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
    });
}


request(config.host + '_csv', function(err, resp, body) {
    dsv.csv.parse(body).forEach(function(row) {
        var layer = L.geoJson(JSON.parse(row.geojson));
        layer._dat = row;
        featureLayer.addLayer(layer);
    });
});
