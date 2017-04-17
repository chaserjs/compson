
let fs = require('fs');
let compson=require("../src/compson.js");

function transform(category, prefix, item) {

  switch(category) {

    case 'furniture': {
      if(item.nextTo) {
          item.nextTo = prefix + item.nextTo;
      }
      break;
    }

    case 'decoration': {
      break;
    }

    case 'appliances': {
      break;
    }

    case 'accessories': {
      break;
    }

    default: {
      break;
    }

  }

}

function runCompson(file) {

  let schema = {
    furniture: {},
    decoration: {},
    appliances: {},
    accessories: {},
    modules: {modules: true}
  };

  let keywords = {
  };

  var s = fs.readFileSync(file, "utf8");

  var data = JSON.parse(s);

  var data2 = compson(data, schema, keywords, transform);

  let s2 = JSON.stringify(data2, null, 4);

  /* eslint no-console: ["error", { allow: ["log"] }] */
  console.log(s2);

  return data2;
}

let args = process.argv.slice(2);

for(let i in args) {
  let file = args[i];
  runCompson(file);
}
