/**
 * Created by Xaz on 3/11/2016.
 */

/*
 Author: Chris Kirchner
 Organization: OSU
 Class: CS340 Databases
 Assignment: CS340 DB Final Project
 Date: 13Mar16
 Purpose: client-side database interface for search functionality in analytical
 resource manager
 */

//xmlhttprequest function for search query
function makeXHR (callback){
    return function(data){
        var request = new XMLHttpRequest();
        //hard-code url, probably better way
        url = 'http://52.10.35.103:3001/search';
        request.open('POST', url, true);
        request.setRequestHeader('Content-Type', 'application/json');
        request.addEventListener('load', function(){
            if(request.status >= 200 && request.status < 400){
                callback(JSON.parse(request.responseText));
            }
            else {
                console.log("Error in network request: " + request.status);
            }
        });
        request.send(JSON.stringify(data));
    }
}

//shows the result of search by changing cell background-colors
var postSearchResult = function(result){
    var badColor = '#CD2B37';
    var goodColor = '#009146';

    //get results of each resource availability
    var analysts = result[0][0]["COUNT(a.aid)"];
    var instruments = result[1][0]["COUNT(i.iid)"];
    var quantity;
    if (result[2][0]){
        quantity = result[2][0]["qty"];
    }
    else {
        quantity = 0;
    }
    var method = result[3][0]["COUNT(mid)"];
    var analyst_res = document.getElementById("analyst-resource");
    analyst_res.style.color = 'white';

    //change backgrounds depending on resource availability
    if (analysts > 0){
        analyst_res.style.backgroundColor = goodColor;
    }
    else {
        analyst_res.style.backgroundColor = badColor;
    }

    var method_res = document.getElementById("method-resource");
    method_res.style.color = 'white';
    if (method > 0){
        method_res.style.backgroundColor = goodColor;
    }
    else {
        method_res.style.backgroundColor = badColor;
    }

    var instrument_res = document.getElementById("instrument-resource");
    instrument_res.style.color = 'white';
    if (instruments > 0){
        instrument_res.style.backgroundColor = goodColor;
    }
    else {
        instrument_res.style.backgroundColor = badColor;
    }

    var quantity_res = document.getElementById("lot-resource");
    quantity_res.style.color = 'white';
    if (quantity > 0){
        quantity_res.style.backgroundColor = goodColor;
    }
    else {
        quantity_res.style.backgroundColor = badColor;
    }
};

//add search function callback for evaluating and presenting results
var search = document.getElementById("search-form");
var makeSearch = makeXHR(postSearchResult);
search.addEventListener('submit', function(event){
    event.preventDefault();
    var data = {};
    for (var i=0; i<this.elements.length; i++){
        data[this.elements[i].name] = this.elements[i].value;
    }
    makeSearch(data);
});
