/* Trigger Name: AWS - RDS
 * Author: ExtraHop
 * Date: 04/06/2014
 * Description: Monitor AWS RDS performance
 * Event: DB_REQUEST, DB_RESPONSE
 * Has "USER_SET": True
 */

// USER_SET: Log metrics to CloudWatch if configured
var log_cloudwatch = false;

if (Flow.server.device.hwaddr != 'fe:ff:ff:ff:ff:ff') {
    return;
}

if (event == "DB_REQUEST") {
    Flow.store.rdsStatement = DB.statement;
    return;
}
else if (event == "DB_RESPONSE") {
    
    var app = Application("AWS - RDS");
    var tprocess = DB.tprocess;
    var statement = Flow.store.rdsStatement;
    var rtt = DB.roundTripTime;
    var reqBytes = DB.reqBytes;
    var rspBytes = DB.rspBytes;
    var db = DB.database;
    var error = DB.error;
    
    if (log_cloudwatch) {
        RemoteSyslog.info('<AWS_CONNECT>METRIC:RDS:processTime:'+tprocess+'</AWS_CONNECT>');
    }
    
    app.metricAddCount('rds-iops',1);
    app.metricAddDetailCount('rds-iops-detail-db',db,1);
    
    app.metricAddCount('rds-tprocess',tprocess);
    app.metricAddDetailCount('rds-tprocess-detail-db',db,tprocess);
    
    app.metricAddSampleset('rds-tprocess',tprocess);
    app.metricAddDetailSampleset('rds-tprocess-detail-statement',statement,tprocess);
    app.metricAddDetailSampleset('rds-tprocess-detail-db',db,tprocess);
    
    app.metricAddSampleset('rds-rtt',rtt);
    app.metricAddDetailSampleset('rds-rtt-detail-statement',statement,rtt);
    app.metricAddDetailSampleset('rds-rtt-detail-db',db,rtt);
    
    app.metricAddCount('rds-reqbytes',reqBytes);
    app.metricAddCount('rds-rspbytes',rspBytes);
    app.metricAddDetailCount('rds-reqbytes-detail-statement',statement,reqBytes);
    app.metricAddDetailCount('rds-reqbytes-detail-db',db,reqBytes);
    app.metricAddDetailCount('rds-rspbytes-detail-statement',statement,rspBytes);
    app.metricAddDetailCount('rds-rspbytes-detail-db',db,rspBytes);
    
    if (error != null) {
        app.metricAddCount('rds-error',1);
        app.metricAddDetailCount('rds-error-detail-statement',statement,1);
        app.metricAddDetailCount('rds-error-detail-db',db,1);
        app.metricAddDetailCount('rds-error-detail-error',error,1);
    }
    app.commit();
}
