CompSON
=========

CompSON turns json files into modules.

When creating a new json data file, you can **include** contents of other data files and modify the data objects to fit your needs. You can **clone**, **modify**, **replace**, or **hide** any data object in your files and you can use **regular expressions** to perform group operations.

## Installation

  `npm install --save compson`

## Example

```js
let compson = require('compson');

let schema = {
  furniture: {}
};

let hotelRoom = {
  "furniture": {
    "bed1": {
      "type": "bed",
      "size": "queen",
      "linens": "silk",
      "mattress": "foam"
    },
    "bed2": {
      "clone": "bed1",
      "mattress": "innerspring"
    }
  }
}
;

let output = compson(hotelRoom, schema, null, null);

console.log(JSON.stringify(output, null, 4));
```

The output should be

```JSON
{
    "furniture": {
        "bed1": {
            "type": "bed",
            "size": "queen",
            "linens": "silk",
            "mattress": "foam"
        },
        "bed2": {
            "type": "bed",
            "size": "queen",
            "linens": "silk",
            "mattress": "innerspring"
        }
    }
}
```


## Tests

  `npm test`

## License

MIT
