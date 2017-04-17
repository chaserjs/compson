var _ = require("lodash");
var isEmpty = _.isEmpty;
var assign = _.assign;

function isNode() {
  return typeof process != "undefined" && process.release && process.release.name === "node";
}

function isNashorn() {
  /* global java javax */
  return typeof java != "undefined" && typeof javax != "undefined" && javax && javax.script && javax.script.ScriptEngineManager;
}

var fs = isNode() && require("fs");

function compson(design, schema, keywords, transform) {
  var defaultKeywords = {
    // Internal keywords
    "name": "_name",

    // Design keywords
    "clone": "clone",
    "private": "private",
    "abstract": "abstract",
    "final": "final",
    "hidden": "hidden",
    "separator": ".",

    // Schema keywords
    "modules": "modules"
  };

  keywords = assign({}, defaultKeywords, keywords);
  transform = transform || function() {};

  function assert(e, message) {
    if(!e) {
      throw new Error("Assert failed: "+message);
    }
  }

  function isValidUrl(str) {
    var pattern = /^(?:(?:(?:https?|ftp):)?\/\/)(?:\S+(?::\S*)?@)?(?:(?!(?:10|127)(?:\.\d{1,3}){3})(?!(?:169\.254|192\.168)(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})).?)(?::\d{2,5})?(?:[/?#]\S*)?$/i;

    return pattern.test(str);
  }

  function nameItem(prefix, name, item) {
    assert(!item.hasOwnProperty(keywords.name), "Item "+name+" can't have property: "+keywords.name);

    item[keywords.name] = prefix + name;

    if(item[keywords.clone] && typeof item[keywords.clone] != "boolean") {
      item[keywords.clone] = prefix+item[keywords.clone];
    }
  }

  function nameCategoryItem(category, prefix, name, item) {
    assert(!item.hasOwnProperty(keywords.name), "Item "+name+" can't have property: "+keywords.name);

    item[keywords.name] = category + keywords.separator + prefix + name;

    if(item[keywords.clone] && typeof item[keywords.clone] != "boolean") {
      item[keywords.clone] = category + keywords.separator + prefix+item[keywords.clone];
    }

    if(transform && prefix) {
      transform(category, prefix, item);
    }
  }

  function flattenCategory(design, category, prefix, a) {
      if(design && design[category]) {
        for (var name in design[category]) {
          if (design[category].hasOwnProperty(name)) {
            var item = design[category][name];
            nameCategoryItem(category, prefix, name, item);
            a.push(item);
          }
        }
      }
  }

  function flattenModules(modules, prefix, a) {
    if(modules) {
      for (var name in modules) {
        if (modules.hasOwnProperty(name)) {
          var module = modules[name];
          var newPrefix = prefix+name+keywords.separator;
          flattenDesign(module, newPrefix, a);
        }
      }
    }
  }

  function loadModule(modulePath) {
      var moduleStr = null;

      if(isNode()) {
        moduleStr = fs.readFileSync(modulePath, "utf8");
      } else if(isNashorn()) {
        var file = new java.io.File(modulePath);
        var charset = java.nio.charset.Charset.forName("UTF-8");
        moduleStr = new java.lang.String (java.nio.file.Files.readAllBytes(file.toPath()),charset);
      } else {
        throw new Error("Not supported javascript platform (use node or nashorn)");
      }

      var design = JSON.parse(moduleStr);

      return design;
  }

  function flattenDesign(design, prefix, a) {
      if(design) {
        var modules = [];

        if(typeof design === "string") {
          if(isValidUrl(design)) {
            // not supported yet
          } else {
            design = loadModule(design);
          }
        }

        for (var category in design) {
          if (design.hasOwnProperty(category)) {
            if (schema.hasOwnProperty(category)) {
              if(schema[category][keywords.modules]) {
                modules.push(design[category]);
              } else {
                flattenCategory(design, category, prefix, a);
              }
            } else {
              var item = design[category];
              nameItem(prefix, category, item);
              a.push(item);
            }
          }
        }

        // Flatten the modules last
        for(var i in modules) {
          flattenModules(modules[i], prefix, a);
        }
      }
  }

  function expand(design1, item) {
    var expanded = [];
    var itemName = item[keywords.name];

    if(itemName.endsWith("/")) {
      // It is regexp
      var startRegexp = itemName.indexOf("/");

      assert(startRegexp < itemName.length-1, "RegExp name must contain two slash characters: "+itemName);

      var regexpStr = itemName.substring(startRegexp+1, itemName.length-1);

      var regexp = new RegExp(regexpStr);

      var prefix = itemName.substring(0, startRegexp);

      for(var name in design1) {
        if(name.startsWith(prefix) && regexp.test(name.substring(prefix.length))) {
            var copy = assign({}, item);
            copy[keywords.name] = name;
            if(copy[keywords.clone] === true) {
              copy[keywords.clone] = name;
            }
            expanded.push(copy);
        }
      }
    } else {
      expanded.push(item);
    }

    return expanded;
  }

  function resolveChain(design, name) {
    var item = design[name];

    assert(item, name);

    if(item.resolved) {
      return;
    }

    if(item.resolving) {
      throw new Error("Infinite cycle in chain of clones including: "+item.original[keywords.name]);
    }

    item.resolving = true;

    var cloneName = item.original[keywords.clone];

    assert(typeof cloneName != "boolean", "Item "+name+": invalid clone name: "+cloneName);
    assert(cloneName, "cloneName");

    resolveChain(design, cloneName);

    var cloneItem = design[cloneName];

    assert(cloneItem, "cloneItem");
    assert(cloneItem.resolved, "cloneItem.resolved");
    assert(cloneItem.final, "cloneItem.final");

    assert(!cloneItem.final[keywords.final], "Can't clone final item: "+cloneName);
    assert(!cloneItem.final[keywords.private], "Can't clone private item: "+cloneName);

    var cloned = assign({}, cloneItem.final, item.original);
    delete cloned[keywords.clone];
    item.final = cloned;
    item.resolved = true;
  }

  function phase1(flatDesign) {
    var design1 = {};

    for(var i = flatDesign.length-1; i >= 0; i--) {
      var items = expand(design1, flatDesign[i]);

      for(var j in items) {
        var item = items[j];
        var itemName = item[keywords.name];

        if(!isEmpty(item) && item[keywords.clone]) {
          item = {resolved: false, resolving: false, original: item, final: null};
        } else {
          item = {resolved: true, resolving: false, original: item, final: item};
        }

        var design1Item = design1[itemName];
        if(design1Item === undefined) {
          design1[itemName] = item;
        } else {
          // conflict
          var oCloneName = item.original[keywords.clone];
          if(!item.resolved && (oCloneName === true || oCloneName == itemName)) {
            //
            // Special case: clone in place & replace
            //
            if(design1Item.resolved) {
              assert(design1Item.final, "design1Item.final");
              assert(!design1Item.final[keywords.final], "Can't clone final item: "+itemName);
              assert(!design1Item.final[keywords.private], "Can't clone private item: "+itemName);

              var cloned1 = assign({}, design1Item.final, item.original);
              delete cloned1[keywords.clone];
              item = {resolved: true, original: item.original, final: cloned1};
            } else {
              assert(design1Item.original, "design1Item.original");
              assert(!design1Item.original[keywords.final], "Can't clone final item: "+itemName);
              assert(!design1Item.original[keywords.private], "Can't clone private item: "+itemName);

              delete item.original[keywords.clone];
              var cloned2 = assign({}, design1Item.original, item.original);
              item = {resolved: false, original: cloned2, final: null};
            }
          }
          design1[itemName] = item;
        }
      }
    }

    return design1;
  }

  function phase2(design1) {
    for(var name in design1) {
      resolveChain(design1, name);
    }
  }

  function phase3(design1) {
    var flatDesign3 = [];
    for(var name in design1) {
      var item = design1[name].final;

      assert(!item[keywords.abstract], "Abstract item has to be cloned: "+name);

      assert(item, "item");
      assert(name == item[keywords.name], "name == item[keywords.name]");

      if(item[keywords.hidden] === true) {
        continue;
      }

      if(item[keywords.private] === true) {
        continue;
      }

      flatDesign3.push(item);
    }

    return flatDesign3;
  }

  function phase4(flatDesign3) {
    var design4 = {};
    for(var i = flatDesign3.length-1; i >=0; i--) {
      var item = flatDesign3[i];
      var name = item[keywords.name];

      delete item[keywords.name];

      var doti = name.indexOf(keywords.separator);
      if(doti < 0) {
        design4[name] = item;
      } else {
        var category = name.substring(0, doti);

        if(schema[category]) {
          var newName = name.substring(doti+keywords.separator.length);

          if(!design4[category]) {
            design4[category] = {};
          }
          design4[category][newName] = item;
        } else {
          // Ignoring uncategorized objects from the modules
        }
      }
    }

    return design4;
  }

  function processDesign(design) {

    //
    // PHASE0 - flatten
    //
    var flatDesign = [];
    flattenDesign(design, "", flatDesign);

    //
    // PHASE1 - bottom up resolutions
    //
    var design1 = phase1(flatDesign);

    //
    // PHASE2 - chain resolutions
    //
    phase2(design1);

    //
    // PHASE3 - flatten and remove hidden
    //
    var flatDesign3 = phase3(design1);

    //
    //  PHASE4 - recategorize
    //
    var design4 = phase4(flatDesign3);

    return design4;
  }

  var processedDesign = processDesign(design);

  return processedDesign;
}

if(isNode()) {
  module.exports = compson;
}
