'use strict';

var async = require('async');
var split = require('split');
var inherits = require('util').inherits;
var AbstractConnection = require('abstract-skiff-transport').Connection;
var reconnect = require('reconnect-net');

module.exports = Connection;

function Connection(localNodeId, options, connection) {

  if (!(this instanceof Connection)) {
    return new Connection(localNodeId, options, connection);
  }
  AbstractConnection.call(this);

  var self = this;

  this.localNodeId = localNodeId;
  this.options = options;
  this.inQueue = async.queue(processIncoming, 1);
  this.disconnected = false;

  if (connection) {
    this._c = connection;
    this._server = true;
    this._onConnect(connection);
  }

  function processIncoming(message, cb) {
    self._processIncoming(message, cb);
  }

}

inherits(Connection, AbstractConnection);

var C = Connection.prototype;

C._onceConnected = function _onceConnected(cb) {
  if (!this.disconnected) {
    if (!this._server && !this._r) {
      this._r = this._reconnect();
    }
    if (this._c) {
      cb(this._c);
    }
    else if (!this._server) {
      this._r.once('connect', cb);
    }
  }
};

C._reconnect = function _reconnect() {
  var self = this;

  var r = reconnect();
  r.connect(this.options.port, this.options.hostname);
  r.on('connect', onConnect);
  r.on('disconnect', onDisconnect);
  r.on('reconnect', onReconnect);

  function onConnect(c) {
    self.state = 'connected';
    self._c = c;
    self._onConnect(c);
  }

  function onDisconnect() {
    self.state = 'disconnected';
    self._c = undefined;
  }

  function onReconnect() {
    self.emit('connecting');
  }

  return r;
};

C._onConnect = function _onConnect(c) {
  var self = this;

  c.write(JSON.stringify({hello: self.localNodeId}) + '\n');

  self.emit('connected');

  c.once('close', function() {
    self.emit('disconnected');
  });

  c.on('error', function(err) {
    self.emit('error', err);
  });

  if (this._server) {
    c.once('close', function() {
      self.disconnected = true;
    });
  }

  c.pipe(split()).on('data', onLineData);

  function onLineData(l) {
    var d;
    if (l) {
      try {
        d = JSON.parse(l);
      } catch (err) {
        self.emit('error', err);
      }
      if (d !== undefined) {
        self.inQueue.push(d);
      }
    }
  }
};

C._close = function _close(cb) {
  var self = this;
  var calledback = false;

  if (this._r) {
    this._r.disconnect();
    if (this.state == 'disconnected') {
      setImmediate(cb);
    } else {
      this._r.once('disconnect', closed);
    }
  }
  if (this._c) {
    this._c.once('close', closed);
    this._c.end();
  }

  function closed() {
    if (!calledback) {
      calledback = true;
      self.disconnected = true;
      if (cb) {
        cb();
      }
      self.emit('close');
    }
  }
};

C._send = function _send(type, args, cb) {
  var self = this;

  this._onceConnected(function(c) {
    self.once('response', onResponse);
    try {
      c.write(JSON.stringify({request: [type, args]}) + '\n', onWrite);
    } catch (err) {
      cb(err);
    }
  });

  function onResponse(d) {
    cb.apply(null, d);
  }

  function onWrite(err) {
    if (err) {
      self.emit('error', err);
    }
  }
};

C._receive = function _receive(fn) {
  var self = this;

  this.on('request', onRequest);

  function onRequest(args) {
    fn.call(null, args[0], args[1], onReply);
  }

  function onReply() {
    var args = Array.prototype.slice.call(arguments);
    self._onceConnected(function(c) {
      c.write(JSON.stringify({response: args}) + '\n', onWrite);
    });
  }

  function onWrite(err) {
    if (err) {
      self.emit('error', err);
    }
  }
};

C._processIncoming = function _processIncoming(message, cb) {
  if (message.response) {
    this.emit('response', message.response);
  }
  else if (message.request) {
    this.emit('request', message.request);
  }
  else if (message.hello) {
    this.emit('hello', message.hello);
  }
  setImmediate(cb);
};
