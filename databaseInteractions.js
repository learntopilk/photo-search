//this file handles all database interactions!
//Database address:
//mongodb://<dbuser>:<dbpassword>@ds157964.mlab.com:57964/jonbase
var mongo = require("mongodb").MongoClient;

var user = process.env.MONGODB_USER;
var pwd = process.env.MONGODB_PASSWORD;
var url = "mongodb://"+user+":"+pwd+"@ds157964.mlab.com:57964/jonbase";

exports.getRecent = function(callback){
  mongo.connect(url, function(err, db){
    if(err){
      console.log(err);
      return callback(null);
    }
    console.log("connecting...");
    var coll = db.collection("searches");    
     coll.find().sort({_id:-1}).limit(10).toArray(function(err, result){
      if (err){
        console.log(err);
        throw err;
      }
      console.log(result);
      return callback(result);
    });
    db.close();
  });
}

exports.updateLatest = function (searchString, callback){
  //Create date string to use for giving each search a time stamp
  var dat = new Date(Date.now()).toISOString();
  
  mongo.connect(url, function(err, db){
    if (err) {
      throw err;
    }
    var coll = db.collection('searches');
    
    coll.count({}, function(err,resp){
      coll.insert({"searchTerm": searchString, "time": dat}, function(err, response){
        if(err) {throw err;}
        callback((parseInt(resp) + 1));
        db.close();      
      });
    });
  });
}