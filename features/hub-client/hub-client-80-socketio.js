'use strict';

module.exports = function($allonsy, $processIndex, $SocketsService, $server) {

  if (!process.env.EVENTS_HUB_CLIENT || process.env.EVENTS_HUB_CLIENT != 'true') {
    return;
  }

  var crypto = require('crypto'),
      ioClient = require('socket.io-client'),
      _each = $SocketsService.each,
      _emit = $SocketsService.emit,
      _hubUrl = process.env.EVENTS_HUB_CLIENT_URL,
      _hubSecret = process.env.EVENTS_HUB_CLIENT_SECRET,
      _socket = ioClient.connect(_hubUrl),
      _socketEmit = _socket.emit;

  function _toHubEmit(event, message) {
    message = typeof message == 'object' ? message : {};
    message.event = event;
    message.noOwner = true;

    message = _encrypt(JSON.stringify(message), _hubSecret);

    _socketEmit.apply(_socket, ['!', message]);
  }

  function _encrypt(text, secret) {
    var cipher = crypto.createCipher('aes-256-ctr', secret);

    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  }

  $SocketsService.socketHub = function() {
    return _socket;
  };

  $SocketsService.each = function(iterateFunc, includeHub) {
    if (includeHub && _socket) {
      if (iterateFunc(_socket, _socket.id) === false) {
        return;
      }
    }

    _each.apply($SocketsService, arguments);
  };

  $SocketsService.emit = function(ownerSocket, filters, socketAction, eventName, args, includeHub) {
    if (includeHub) {
      $SocketsService.emitHub(ownerSocket, filters, socketAction, eventName, args);
    }

    _emit.apply($SocketsService, arguments);
  };

  $SocketsService.emitHub = function(ownerSocket, filters, socketAction, eventName, args) {
    if (!_socket) {
      return false;
    }

    _encapsulateEmit();
    $SocketsService.emitSocket(_socket, ownerSocket, filters, socketAction, eventName, args);
    _encapsulateEmit(false);
  };

  function _encapsulateEmit(encapsulate) {
    encapsulate = typeof encapsulate != 'boolean' ? true : encapsulate;

    _socket.emit = encapsulate ? _toHubEmit : _socketEmit;
  }

  _socket.on('connect', function() {
    $allonsy.outputInfo('  Connected with the Events HUB (' + _hubUrl + ')');

    _socket.emit('who', _encrypt(JSON.stringify({
      who: 'Express server #' + $processIndex,
      url: process.env.EXPRESS_URL + ':' + $server.get('port')
    }), _hubSecret));
  });

  _socket.on('disconnect', function() {
    _socket = null;

    $allonsy.outputWarning('  Disconnected from the Events HUB (' + _hubUrl + ')');
  });
};
