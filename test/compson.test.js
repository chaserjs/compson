let compson=require("../src/compson.js");

/* global test */
test("clone", function() {
  let schema = {
    furniture: {}
  };

  let keywords = {
  };

  let data = {
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
  };

  let transform = null;

  let data2 = compson(data, schema, keywords, transform);

  let expData2 = {
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
  };

  /* global expect */
  expect(data2).toEqual(expData2);
});
