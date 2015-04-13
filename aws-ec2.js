/* Trigger Name: AWS - EC2
 * Author: ExtraHop
 * Date: 11/6/2013
 * Description: Monitor your EC2 environment
 * Event: HTTP_REQUEST, HTTP_RESPONSE, SSL_CLOSE
 * Has "USER_SET": True
 */

// USER_SET: Export metrics to CloudWatch if configured
var log_cloudwatch = false;

var internalIP;
var externalIP;
var serverIP;
var clientIP;
var reqBytes;
var rspBytes;
var bytesOut;
var bytesIn;
var uri;
var status;
var tprocess;
var rtt;

if (event == 'HTTP_REQUEST') {
    Flow.store.query = HTTP.query;
    return;
}
else if (event == "HTTP_RESPONSE") {
    // Response from EC2 instance 
    if ((Flow.client.device.hwaddr == "fe:ff:ff:ff:ff:ff") &&  (HTTP.origin != null)) {
        internalIP = Flow.server.ipaddr;
        externalIP = HTTP.origin;
        bytesOut = HTTP.rspBytes;
        bytesIn = HTTP.reqBytes;
        uri = HTTP.uri;

    }
    // Request from EC2 instance
    else if ((Flow.server.device.hwaddr == "fe:ff:ff:ff:ff:ff") && (HTTP.uri.indexOf('amazonaws.com') == -1 ) && (Flow.server.ipaddr.isRFC1918 == false)) {
        internalIP = Flow.client.ipaddr;
        externalIP = Flow.server.ipaddr;
        bytesIn = HTTP.rspBytes;
        bytesOut = HTTP.reqBytes;
        uri = 'External URI: ' + HTTP.uri;
    }
    // Internal only traffic metrics
    else {
        serverIP = Flow.server.ipaddr;
        clientIP = Flow.client.ipaddr;
        rspBytes = HTTP.rspBytes;
        reqBytes = HTTP.reqBytes;
        uri = HTTP.uri;
    }
    // Internal error checking
    if (Flow.server.ipaddr.isRFC1918) {
        status = HTTP.statusCode;
        rtt = HTTP.roundTripTime;
        tprocess = HTTP.tprocess;
        if (log_cloudwatch) {
            RemoteSyslog.info('<AWS_CONNECT>METRIC:EC2:processTime:'+tprocess+'</AWS_CONNECT>');
        }
    }   
}
else if (event == "SSL_CLOSE") {
    var sipaddr = Flow.server.ipaddr;
    var cipaddr = Flow.client.ipaddr;
    // Internal EC2 request to outside server
    if (sipaddr.hostNames) {
        shost = sipaddr.hostNames[0];
        if (!(sipaddr.isRFC1918) && (shost.indexOf('amazonaws.com') == -1)) {
            internalIP = cipaddr;
            externalIP = sipaddr;
            bytesOut = SSL.reqBytes;
            bytesIn = SSL.rspBytes;
            uri = 'SSL host: ' + shost;
        }
    }
    // External request to EC2
    if (cipaddr.hostNames) {
        chost = cipaddr.hostNames[0];
        if (!(cipaddr.isRFC1918) && (chost.indexOf('amazonaws.com') == -1)) {
            internalIP = sipaddr;
            externalIP = cipaddr;
            bytesIn = SSL.reqBytes;
            bytesOut = SSL.rspBytes;
            uri = 'External SSL: ' + chost;
        }
    }
}
else {
    return;
}

var app = Application("AWS - EC2");

var query = Flow.store.query;
if (query) {
    uri = uri+'?'+query;
    Flow.store.query = null;
}

if (status && (status > 399)) {
    app.metricAddCount('aws-ec2-status-error',1);
    app.metricAddDetailCount('aws-ec2-status-error-detail-server',Flow.server.ipaddr,1);
    app.metricAddDetailCount('aws-ec2-status-error-detail-uri',HTTP.uri,1);
    app.metricAddDetailCount('aws-ec2-status-error-detail-status',''+status,1);
}
if (tprocess && rtt) {
    
    app.metricAddDataset('aws-ec2-ttotal',rtt+HTTP.rspTimeToLastByte);
    app.metricAddDetailDataset('aws-ec2-ttotal-detail-serverIP',serverIP,rtt+HTTP.rspTimeToLastByte);
    
    Device.metricAddDataset('aws-ec2-tprocess',tprocess);
    Device.metricAddDataset('aws-ec2-rtt',rtt);
    Device.metricAddDataset('aws-ec2-ttotal',rtt+HTTP.rspTimeToLastByte);
}

if (externalIP != undefined) {

    // Outbound metrics
    app.metricAddCount('aws-outbound-bytes',bytesOut);
    app.metricAddCount('aws-outbound-connections',1);
    app.metricAddDetailCount('aws-outbound-bytes-detail',externalIP,bytesOut);
    app.metricAddDetailCount('aws-outbound-bytes-detail-uri',uri,bytesOut);
    
    Device.metricAddCount('aws-device-outbound-bytes',bytesOut);
    Device.metricAddCount('aws-device-outbound-connections',1);
    
    // Inbound metrics
    app.metricAddCount('aws-inbound-bytes',bytesIn);
    app.metricAddDetailCount('aws-inbound-bytes-detail',externalIP,bytesIn);
    
    Device.metricAddCount('aws-device-inbound-bytes',bytesIn);
    Device.metricAddCount('aws-device-inbound-connections',1);
    Device.metricAddDetailCount('aws-device-inbound-bytes-detail',internalIP,bytesIn);
    Device.metricAddDetailCount('aws-device-inbound-bytes-detail-uri',uri,bytesIn);
    
    if (tprocess) {
        app.metricAddDetailSampleset('aws-outbound-bytes-detail-tprocess',externalIP,tprocess);
        app.metricAddDetailSampleset('aws-outbound-bytes-detail-rtt',externalIP,rtt);
    }
}
// Internal EC2 metrics
else if (serverIP != undefined) {
    
    app.metricAddCount('aws-ec2-internal-connections',1);
    Device.metricAddCount('aws-device-ec2-internal-connections',1);
    
    // Request metrics
    app.metricAddCount('aws-ec2-internal-reqbytes',reqBytes);
    app.metricAddDetailCount('aws-ec2-internal-reqbytes-detail-server',serverIP,reqBytes);
    app.metricAddDetailCount('aws-ec2-internal-reqbytes-detail-client',clientIP,reqBytes);
    app.metricAddDetailCount('aws-ec2-internal-reqbytes-detail-uri',uri,reqBytes);
    
    Device.metricAddCount('aws-device-ec2-internal-reqbytes',reqBytes);
    Device.metricAddDetailCount('aws-device-ec2-internal-reqbytes-detail-server',serverIP,reqBytes);
    Device.metricAddDetailCount('aws-device-ec2-internal-reqbytes-detail-client',clientIP,reqBytes);
    Device.metricAddDetailCount('aws-device-ec2-internal-reqbytes-detail-uri',uri,reqBytes);
    
    // Response metrics
    app.metricAddCount('aws-ec2-internal-rspbytes',rspBytes);
    app.metricAddDetailCount('aws-ec2-internal-rspbytes-detail-server',serverIP,rspBytes);
    app.metricAddDetailCount('aws-ec2-internal-rspbytes-detail-client',clientIP,rspBytes);
    app.metricAddDetailCount('aws-ec2-internal-rspbytes-detail-uri',uri,rspBytes);
    
    Device.metricAddCount('aws-device-ec2-internal-rspbytes',rspBytes);
    Device.metricAddDetailCount('aws-device-ec2-internal-rspbytes-detail-server',serverIP,rspBytes);
    Device.metricAddDetailCount('aws-device-ec2-internal-rspbytes-detail-client',clientIP,rspBytes);
    Device.metricAddDetailCount('aws-device-ec2-internal-rspbytes-detail-uri',uri,rspBytes);
}
app.commit();
