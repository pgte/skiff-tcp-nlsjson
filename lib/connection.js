'use strict';

var split = require('split');
var inherits = require('util').inherits;
var AbstractConnection = require('abstract-skiff-transport').Connection;
var reconnect = require('reconnect-net');

module.exports = Connection;

function Connection(options) {
  AbstractConnection.call(this);

  this.options = options;
}

inherits(Connection, AbstractConnection);

var C = Connection.prototype;

C._onceConnected = function _onceConnected(cb) {
  if (!this._r) {
    this._r = this._reconnect();
  }
  if (this._c) {
    cb(this._c);
  } else {
    this._r.once('connect', cb);
  }
};

C._reconnect = function _reconnect() {
  var self = this;

  var r = reconnect(onConnect);
  r.connect(this.options.port, this.options.host || this.options.hostname);
  r.on('disconnect', onDisconnect);

  function onConnect(c) {
    self._c = c;
    c.pipe(split()).on('data', onLineData);
  }

  function onLineData(l) {
    var d;
    if (l) {
      try {
        d = JSON.parse(l);
      } catch (err) {
        self.emit('error', err);
      }
      if (d !== undefined) {
        if (d.response) {
          self.emit('response', d.response);
        }
        else if (d.request) {
          self.emit('request', d.request);
        }
      }
    }
  }

  function onDisconnect() {
    self._c = undefined;
  }

  return r;
};

C._close = function _close(cb) {
  var calledback = false;

  if (this._r) {
    this._r.disconnect();
    this._r.once('disconnect', closed);
  }
  if (this._c) {
    this._c.once('close', closed);
    this._c.end();
  }

  function closed() {
    if (!calledback) {
      calledback = true;
      cb();
    }
  }
};

C._send = function(type, args, cb) {
  var self = this;
  this._onceConnected(function(c) {
    self.once('response', onResponse);
    c.write(JSON.stringify({request: [type, args]}) + '\n');
  });

  function onResponse(d) {
    cb(null, d);
  }
};

C._receive = function(fn) {
  var self = this;
  this.on('request', onRequest);

  function onRequest(args) {
    fn.call(null, args[0], args[1], onReply);
  }

  function onReply() {
    var args = Array.prototype.slice.call(arguments);
    self._onceConnected(function(c) {
      c.write(JSON.stringify({response: args}) + '\n');
    });
  }
};
