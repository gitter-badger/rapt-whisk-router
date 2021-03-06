
var jqgo = require('jquerygo');

console.log('Start client1.');

// stop the client after a while
setTimeout (function () {
  console.log("Stopping client1...");
  process.exit(0);
}, 12000);


/*
  attributes
*/

var test_log = function (level, descr, attr) {
  console.log(level + ': Session Test: ' + descr);
}


/* 
  main client body
*/

setTimeout(function () {

jqgo.visit('http://localhost:8080/', function() {
  test_log('info','visit');
  
  // phantom.js waitForPage  
  jqgo.waitForPage(function(){
    test_log('info','waitForPage');

    // phantom.js getPage
    jqgo.getPage(function(page) {
      test_log('info', 'getPage');
      
      var eval_attr = { // data passed to the evaluate
        test_log: test_log 
        // NOTE: functions are not passed for some reason 
        //  (test_log will be undefined on the other side)
      };

      //console.log('client1 now waiting at ' + CHRO.Model.current_location);
      
      jqgo('#button-enter-beach').click(function() {
      //jqgo('#button-enter-dog_park').click(function() { // NOTE: this would cause the location test to fail
      setTimeout(function () {

        // phantom.js evaluate
        page.evaluate(function(args) {
          var score_card = {}; // used to store data withing the phantom.js page environment
           
          // NOTE: javascript in this function is executed in-page!
          // at this point, socket.io has connected, session confirmed, and user relocated to beach

          console.log('info: page.evaluate: client1 begin interacting with javascript of page.');
          console.log('info: page.evaluate: client1 user_id=' + CHRO.Model.user.id);

          // test out a websocket tear_down       
          //Whisk.WebSocket.tear_down();
          // NOTE: this would cause the websocket session test to fail 


          // return the client object for testing
          return { client: CHRO };
          
          
          // END: execution of in-page javascript!
          

        }, function(retVal) {
          //console.log('returned value ', retVal);
          
          var CHRO = retVal.client;
        
          console.log('client1 now waiting at ' + CHRO.Model.current_location);

          
          // called when you return from the evaluation.
          test_log('info','completed the page.evaluate.');
          //jqgo.close();
          

        }, eval_attr ); // END page.evaluate

      }, 2000); // END waiting for the relocate signal to return

      }); // END button click
      

    }); // END getPage

  }); // END waitForPage

}); // END visit


}, 5000);
