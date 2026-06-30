(function(window){
  "use strict";

  var cache = Object.create(null);
  var DEFAULT_TTL = 30000;

  function makeKey(scope, key){
    return String(scope || "general") + "::" + String(key || "default");
  }

  function set(scope, key, value, ttl){
    cache[makeKey(scope, key)] = {
      value: value,
      at: Date.now(),
      ttl: Number(ttl || DEFAULT_TTL)
    };
    return value;
  }

  function get(scope, key){
    var item = cache[makeKey(scope, key)];
    if(!item){ return null; }
    if(Date.now() - item.at > item.ttl){
      delete cache[makeKey(scope, key)];
      return null;
    }
    return item.value;
  }

  function clear(scope){
    if(!scope){
      cache = Object.create(null);
      return;
    }
    Object.keys(cache).forEach(function(k){
      if(k.indexOf(String(scope) + "::") === 0){ delete cache[k]; }
    });
  }

  window.BDLCache = {
    set: set,
    get: get,
    clear: clear
  };
})(window);
