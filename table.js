/**
 * Created by Xaz on 2/28/2016.
 */

//table function gets table information from database
module.exports = {
    renderTable: function(mysqlPool, table, next, req, res) {
        mysqlPool.query(
            "SELECT * FROM " + table,
            function (err, rows, fields) {
                if (err){
                    next(err);
                    return;
                }
                req.session[table] = rows;
                //shows page if response present
                if (res){
                    res.render('Analytical-Manager', req.session);
                }
            }
        );
    }
};


