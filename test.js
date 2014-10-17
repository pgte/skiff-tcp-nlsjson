'use strict';

var net = require('net');
var test = require('abstract-skiff-transport/test/all');
var split = require('split');
var Transport = require('./');

var options = {
  startServer: function(cb) {
    var server = net.createServer(onConnection);
    server.listen(8081, function() {
      cb(null, server);
    });

    server.__connections = [];

    function onConnection(c) {

      server.__connections.push(c);
      c.pipe(split()).
        on('data', onLine);

      function onLine(l) {
        if (l) {
          var d = JSON.parse(l);
          c.write(JSON.stringify({response: d.request}) + '\n');
        }
      }

      c.once('close', function() {
        var idx = server.__connections.indexOf(c);
        if (idx >= 0) {
          server.__connections.splice(idx, 1);
        }
      });

    }
  },
  stopServer: function(server, cb) {
    server.close(cb);
  },
  broadcast: function(server, args) {
    var message = JSON.stringify({request: args}) + '\n';
    server.__connections.forEach(function(c) {
      c.write(message);
    });
  },
  intercept: function(server, cb) {
    server.__connections.forEach(function(c) {
      var s = split();
      c.___split = s;
      c.pipe(s).on('data', onLine);
    });

    function onLine(l) {
      if (l) {
        var d = JSON.parse(l);
        server.__connections.forEach(function(c) {
          if (c.___split) {
            c.unpipe(c.___split);
          }
        });
        cb(d.response);
      }
    }

  },
  connect: function() {
    var self = this;

    var c = net.connect(8081, function() {
      c.pipe(split()).on('data', function(line) {
        if (line) {
          var m = JSON.parse(line);
          if (m.hello) {
            c.write(JSON.stringify({helloback: self.listenPeerId}) + '\n');
          }
        }
      });
    });

    return c;
  },
  disconnect: function(c) {
    c.end();
  },
  connectOptions: {port: 8081},
  listenPeerId: 'listenpeerid'
};

test(new Transport(), options);