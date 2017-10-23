// server.js
// @Joonas Viljakainen, 2017
// Image search abstraction layer
// Purpose: To enable the user to search images using a search term and paginate through the results.
// This server utilizes the Bing image search API, for which I have acquired a 30-day trial key. As a result this
// server will have to be modified to use another service or key once that trial period draws to an end.
// Nonetheless, we shall prevail.

//console.log(new Date(Date.now()).toISOString());

// init project
var express = require('express');
var https = require('https');
var app = express();
var database = require('./databaseInteractions.js');

//Init variables for storing data and list of latest searches
var searches = [];
var searches2 = [];
var latestSearchData = [];
database.getRecent(processDBInfo);

//DATABASE search term list processing.
//Not much processing done here, but this is used as the callback function that
//Allows us to access the results withing the scope of server.js
function processDBInfo(recentList){
  searches2 = recentList;
  console.log("This " + recentList[0].searchTerm);
}

//Something to help filter the use of incoming data
function filterBingShit(rawInput){
  //Here we remove the problem strings I have found so far.
  /*
  var corrected = rawInput.toString().replace(new RegExp(/\"\,\"/g), "");
  var corrected2 = corrected.replace(new RegExp(/\:\,/g), '\:');
  var corrected3 = corrected2.replace(new RegExp(/\"\,\:/g), "\"\:");
  corrected3 = corrected3.replace(new RegExp(/\'\,\'\,/g), "\,");
  
  return corrected3;*/
  return rawInput;
}

//Callback function for handling data coming in from the image search API
function calbak (data, count, resp) {
  
  database.getRecent(processDBInfo);
  //Checking that callback gets called and that actual data is passed to it
  console.log("Calling calback");
  var filtered = data;
  //Handling data
  var array = JSON.parse(filtered).value;
  //var count = 0;
  //var respArr = [];
  latestSearchData = [];
  
  for (var i = 0; i < array.length; i++) {
    var el = {};
    el.name = array[i].name;
    el.url = array[i].contentUrl;
    el.size = array[i].contentSize;
    //Add to local cache of latest search
    latestSearchData.push(el);
    //respArr.push(el);
  }
  
  drawLatestData(latestSearchData, count, resp);
  //resp.send(respArr);  
}

function drawLatestData(data, count, resp){
  if (count < 10) {
    count = 10;
  }
  
  //Initializing our HTML document
  //TODO: Do this using a pre-made model document
  var htmlHead = '<html><head><title>Welcome to Glitch!</title><meta name="description" content="A cool thing made with Glitch"><link id="favicon" rel="icon" href="https://glitch.com/edit/favicon-app.ico" type="image/x-icon"><meta charset="utf-8"><meta http-equiv="X-UA-Compatible" content="IE=edge"><meta name="viewport" content="width=device-width, initial-scale=1">    <link rel="stylesheet" href="/style.css">  </head> '; 
  var htmlBodyStart = '<body><header><h1>Some Things</h1></header><main>';
  var els = "<h2>bbb</h2>";
  var htmlBodyEnd =' </main><script></script></body></html>';
  
  var sendable = data.slice(count - 10, count);
  sendable.forEach(function(el){
    //console.log(el);
    var j = '<h6>' + el.name + '</h6><p>' + el.url + '</p>';
    //console.log(j);
    els = els + j;
  });
  
  var html = htmlHead.concat(htmlBodyStart).concat(els).concat(htmlBodyEnd);
  resp.send(els);
  //resp.send(data.slice(count - 10, count));
}

//static files, I guess? Not really sure what this does. Should probably remove it at some point.
app.use(express.static('public'));

//Setting routing for image searches
app.get("/api/imagesearch", function(request, response){
  var pathStart = "/bing/v7.0/images/search?q=";
  var pathEnd = "";
  
  console.log("Search subroutine started.");
  var path = request.url;
  var query = request.query;
  
  //Establishing the value of "Count", which determines the elements displayed and allow for pagination
  var c;
  if (query.count){
    console.log("Count detected: " + query.count);
    c = query.count;
  } else {
    console.log("Using default count 10");
    c = 10;
  }
  
  //If the search term is the same term as last time, send data that has already been retrieved and is still in cache
  if (query.q == searches[0]) {
    console.log("Same data asked for and served twice");
    drawLatestData(latestSearchData, c, response);
  } else {
    
    //we add the current term to the array of recent searches
    searches.unshift(query.q);
    searches2.unshift({searchTerm:query.q,time:Date.now()});
    //Adding the current search term to the database
    database.updateLatest(query.q, function(){
      console.log("Got that update done!");
      return true;
    });
    
    //if there have been 11 searches, cut the list of recent searches down to 10
    if(searches.length > 10){
      searches.splice(searches.length, 1);
    }
    //This is where we forge the real search query path
    var fullPath = pathStart.concat(query.q).concat("&mkt=fi-fi");
  
    //TODO: Validate search term in some way so as to ensure the query makes sense
  
  
    //Forging search options
    var options = {
      
      "host":"api.cognitive.microsoft.com",
      path: fullPath,
      "headers":{
        "data-type":"application/JSON",
        //This key part is kind of important!
        "Ocp-Apim-Subscription-Key": process.env.API_KEY,
      },
      //Initially we only want 40 results back for... brevity? Maybe?
      "count":40
    }

    //Sending request to Bing server
    https.get(options, function(res){
      //Casually making sure we're actually in the sending part
      console.log("HTTPS request sent");
      //Initiate variable for data collection
      var info = [];
    
      res.on("data", function(dat){
        //Simple: convert incoming buffer to string and inject into our accumulator variable "info"
        info.push(dat.toString());
      });
    
      //Error handling,
      res.on("err", function(err){
        console.log("Error at res.on while making https request: " + err);
        throw err;
      });
    
      res.on("end", function(){

        //Transforming the data array into a single string to allow JSON parsing in callback
        var d = info.reduce(function(a, b){return a.concat(b);});
        
        //Calling our data handling function; NOTICE we're giving the response object as a parameter since the function definition
        //is made outside the scope in which the response object is visible. Is that a good thing?
        calbak(d, c, response);
      });
    });
  }
});

app.get("/api/latest/imagesearch/", function(request, response){
  console.log("Latest started"); 
  response.send(JSON.stringify(searches2));
});

//https://cat-ph.glitch.me/api/latest/imagesearch
app.get("/", function (request, response) {
  //Give the clueless user a clue as to the use of the server
  //TODO: Write detailed instructions once the infrastructure has been implemented
  response.send("check out /api/imagesearch/.");
});

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});