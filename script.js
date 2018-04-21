/**
 * Created by Xaz on 2/28/2016.
 */

/*
 Author: Chris Kirchner
 Organization: OSU
 Class: CS340 Databases
 Assignment: CS340 DB Final Project
 Date: 13Mar16
 Purpose: server-side database interface to mysql for analytical resource manager
 */

//use express, handlebrs, POST parser, session, and custom table module
//sessions will hold the database information in the form of table-forms
//for use by handlebars
var express = require('express');
var exphbs = require('express-handlebars');
var session = require('express-session');
var bodyParser = require('body-parser');
//table module selects information from database for given table
var table = require('./table.js');



/* used helper from http://doginthehat.com.au/2012/02/comparison-block-helper-for-handlebars-templates/ */
//helper allows handlebars view-side equality
var hbs = exphbs.create({
    defaultLayout: 'Main',
    helpers: {
        equal: function (lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if( lvalue!=rvalue ) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    }
});

//setup express with handlebars engine
var app = express();
app.engine('handlebars', hbs.engine);
app.set('view engine', 'handlebars');

//setup on port 3001
app.set('port', 3001);

//allow json or urlencoded POSTS
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//tie sessions to express with secret that's not too secret
app.use(session({secret:'SuperSecretPassword'}));
app.use(express.static('public'));

//grab mysql
var mysql = require('mysql');

/* had issues getting corrected date carried over between JS and mysql:
http://stackoverflow.com/questions/11187961/date-format-in-node-js
*/

var pool = mysql.createPool({
    host: 'localhost',
    user: 'student',
    password: 'default',
    database: 'analytical',
    //use date, not datetime
    dateStrings: 'date',
    //allow queries composed of multiple queries
    multipleStatements: true
});


app.get('/analytical-manager', function(req, res, next){
    //build tables on new sessions
    table.renderTable(pool, 'drug_material', next, req);
    table.renderTable(pool, 'instrument', next, req);
    table.renderTable(pool, 'method', next, req);
    table.renderTable(pool, 'analyst', next, req);
    table.renderTable(pool, 'test', next, req);
    table.renderTable(pool, 'analyses', next, req, res);
});

//do stuff when user inserts table-form information
app.post('/insert', function(req, res, next){

    var query;
    var table;
    var id;
    var values;
    var auto_increment = false;

    //drug material INSERTS
    if (req.body["drug_material"]){
        table = "drug_material";
        query = "INSERT INTO drug_material (name, lot, qty) VALUES (?,?,?)";
        values = [req.body.name || null, req.body.lot || null,
            req.body.qty || 0];
        id = "lot";
    }
    //instrument INSERTS
    else if (req.body["instrument"]){
        table = "instrument";
        id = "iid";
        query = "INSERT INTO instrument (iid, name, date_qualified) " +
            "VALUES (?,?,?)";
        values = [req.body[id] || null, req.body.name || null,
            req.body.date_qualified];
    }
    //method INSERTS
    else if (req.body["method"]){
        table = "method";
        id = "mid";
        query = "INSERT INTO method (mid, analyte, instrument_type, file) " +
            "VALUES (?,?,?,?)";
        values = [req.body[id] || null,
            req.body.analyte || null,
            req.body.instrument_type || null,
            req.body.file || null];
    }
    //analyst INSERTS
    else if (req.body["analyst"]){
        table = "analyst";
        id = "aid";
        auto_increment = true;
        query = "INSERT INTO analyst " +
            "(aid, first_name, last_name) VALUES (?,?,?)";
        values = [req.body[id] || null,
            req.body.first_name || null,
            req.body.last_name || null];
    }
    //test INSERTS
    else if (req.body["test"]){
        table = "test";
        id = "tid";
        auto_increment = true;
        query = "INSERT INTO test (mid, iid, aid, date_assigned)" +
            "SELECT ?,?,?,? FROM method WHERE" +
            "(SELECT name FROM instrument i WHERE i.iid=?)" +
            "= (SELECT instrument_type FROM method m WHERE m.mid=?)";

        values = [req.body.mid || null,
            req.body.iid || null,
            req.body.aid || null,
            req.body.date_assigned || null,
            req.body.iid || null,
            req.body.mid || null];
    }
    //analyses INSERTS (sub-form of test table-form)
    else if (req.body["analyses"]){
        table = "analyses";
        query = "INSERT IGNORE INTO analyses (lot, tid) " +
            "SELECT ?,? FROM test WHERE " +
            "(SELECT m.analyte FROM method m INNER " +
            "JOIN test t ON t.mid = m.mid " +
            "WHERE t.tid=?) = " +
            "(SELECT dm.name FROM drug_material dm " +
            "WHERE dm.lot=?);";
        values = [req.body.lot  || null, req.body.tid || null,
            req.body.tid || null, req.body.lot || null];
    }

    //do actually query
    delete req.body[table];
    pool.query(query, values, function(err, result) {
        if (err){
            /*if (err.code = 'ER_BAD_NULL_ERROR'){
                res.render('Analytical-Manager', req.session);
            }*/
            next(err);
            return;
        }
        //get inserted ID if ID is auto_increment (not assigned by user)
        if (auto_increment){
            req.body[id] = result.insertId;
        }
        console.log(result);
        //only manipulate session if db table is manipulated
        if (result.affectedRows > 0){
            req.session[table].push(req.body);
        }
        //show page
        res.render('Analytical-Manager', req.session);
    })
});

//do stuff when user tries to update table
app.post('/update', function(req, res, next){
    var query;
    var table;
    var id;

    //drug material UPDATE
    if (req.body["drug_material"]){
        table = "drug_material";
        id = "lot";
        query = "UPDATE drug_material SET name=?, qty=? WHERE lot=?";
        values = [req.body.name || null,
            req.body.qty || 0,
            req.body[id] || null];
    }
    //instrument UPDATE
    else if (req.body["instrument"]){
        table = "instrument";
        id = "iid";
        query = "UPDATE instrument SET date_qualified=? WHERE iid=?";
        values = [req.body.date_qualified, req.body[id] || null];
    }
    //analyst UPDATE
    else if (req.body["analyst"]){
        table = "analyst";
        id = "aid";
        query = "UPDATE analyst SET aid=?, first_name=?, " +
            "last_name=? WHERE aid=?";
        values = [req.body.first_name || null,
            req.body.last_name || null,
            req.body[id] || null];
    }
    //test UPDATE
    else if (req.body["test"]){
        table = "test";
        id = "tid";
        query = "UPDATE test SET iid=?, aid=?, date_completed=? " +
            "WHERE tid=? AND " +
            "(SELECT name FROM instrument i WHERE i.iid=?) " +
            "= (SELECT instrument_type FROM method m WHERE m.mid=?)";
        values = [req.body.iid || null, req.body.aid || null,
            req.body.date_completed,
            req.body[id] || null, req.body.iid || null, req.body.mid || null];
    }

    delete req.body[table];

    //do actual UPDATE query
    pool.query(query, values, function(err, result) {
        if (err) {
            next(err);
            return;
        }
        if (result.changedRows > 0){
            var tableRows = req.session[table];
            var index;
            tableRows.forEach(function(e){
                if (e[id] == req.body[id]){
                    index = tableRows.indexOf(e);
                }
            });
            tableRows[index] = req.body;
            req.session[table] = tableRows;
        }
        //show page
        res.render('Analytical-Manager', req.session);
    });
});

//do DELETE stuff
app.post('/delete', function(req, res, next){
    var table;
    var id;
    var query;

    //delete function deletes row based on id of row removed
    //used as variable holding function to allow function to change
    //based on multiple IDS (e.g. for analyses table)
    var deleteRows = function(table) {
        var tableRows = req.session[table];
        return tableRows.filter(function (e) {
            return e[id] != req.body[id];
        });
    };

    //drug material DELETE
    if (req.body["drug_material"]){
        table = "drug_material";
        id = "lot";
        values = [req.body[id] || null];
        query = "DELETE FROM " + table + " WHERE " + id + "=?";
    }
    //instrument DELETE
    else if (req.body["instrument"]){
        table = "instrument";
        id = "iid";
        values = [req.body[id] || null];
        query = "DELETE FROM " + table + " WHERE " + id + "=?";
    }
    //method DELETE
    else if (req.body["method"]){
        table = "method";
        id = "mid";
        values = [req.body[id] || null];
        query = "DELETE FROM " + table + " WHERE " + id + "=?";
    }
    //analyst DELETE
    else if (req.body["analyst"]){
        table = "analyst";
        id = "aid";
        values = [req.body[id] || null];
        query = "DELETE FROM " + table + " WHERE " + id + "=?";
    }
    //test DELETE
    else if (req.body["test"]){
        table = "test";
        id = "tid";
        values = [req.body[id] || null];
        query = "DELETE FROM " + table + " WHERE " + id + "=?";
    }
    //analyses DELETE
    else if (req.body["analyses"]){
        table = "analyses";
        values = [req.body.tid || null, req.body.lot || null];
        query = "DELETE FROM " + table + " WHERE tid=? AND lot=?";
        deleteRows = function(table) {
            var tableRows = req.session[table];
            return tableRows.filter(function (e) {
                return (e.tid != req.body.tid || e.lot != req.body.lot);
            });
        };
    }

    //do actual DELETE query stuff
    pool.query(query, values, function(err, result){
        if (err){
            next(err);
            return;
        }
        if (result.affectedRows > 0){
            req.session[table] = deleteRows(table);
        }
        //show page
        res.render('Analytical-Manager', req.session);
    });
});

//magical search query
app.post('/search', function(req, res, next){
    pool.query("SELECT COUNT(a.aid) FROM analyst a " +
        "WHERE a.aid NOT IN (SELECT t.aid FROM test t " +
        "WHERE date_completed IS NULL); " +
        "SELECT COUNT(i.iid) FROM instrument i " +
        "WHERE i.iid NOT IN (SELECT t.iid FROM test t " +
        "WHERE date_completed is NULL) " +
        "AND i.name = ?; " +
        "SELECT qty FROM drug_material WHERE lot = ? " +
        "AND name = ?; " +
        "SELECT COUNT(mid) FROM method " +
        "WHERE analyte = ? AND instrument_type = ?",
        [req.body.instrument || null, req.body.lot || null,
            req.body.analyte || null, req.body.analyte || null,
            req.body.instrument || null],
        function(err, row, fields){
            if (err){
                next(err);
                return;
            }
            //simply returns data from query for evaluation on client-side
            res.send(row);
    });
});

//show page when not found
app.use(function(req, res){
    res.status(404);
    res.render('404');
});

//show errors, like from mysql
app.use(function(err, req, res){
    console.error(err.stack);
    res.type('plain/text');
    res.status(500);
    res.render('500');
});

//give ear to the server on port
app.listen(app.get('port'), function(){
    console.log('Express started on http://localhost:'+
    app.get('port')+'; Press Ctrl-C to terminate.');
});