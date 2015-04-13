/* 
 * Trigger Name: AWS - S3
 * Author: ExtraHop Networks 
 * Date: 09/04/2014
 * Description: Monitor S3 usage
 * Event: HTTP_RESPONSE
 * Has "USER_SET": True
 */

// USER_SET: Export metrics via syslog (e.g to CloudWatch) if configured
var syslog = false;
// USER_SET: Enable per-bucket S3 applications by setting to true
var enablePerBucketApplications = false;

//USER_SET: Discards specific files  
var enableResourceBlacklist = true; 

// Exits early if host exists and doesn't include amazonaws.com
if (HTTP.host && HTTP.host.indexOf('amazonaws.com') === -1) {
    return;
}

// Should match any query format 
// See: http://docs.aws.amazon.com/AmazonS3/2006-03-01/dev/VirtualHosting.html
//
// 1st capture: Possible bucket
// 3rd capture: S3 region (if available)
// 4th capture: Possible bucket or start of resource path
// 5th capture: Resource path
var uriFragments =
    /(.+[^.])?.?(s3|s3-([^.]+))\.amazonaws\.com\/([^\/]+)(\/.+)?/.exec(HTTP.uri);

if (uriFragments === null) {
    return;
}

var app = Application('AWS S3'), bucketApp = null;
var bucket;
var method = HTTP.method;
var statusCode = HTTP.statusCode;
var client = Flow.client.ipaddr;  
var status_message;
var resource;
var region;
var tprocess = HTTP.tprocess;
var rtt = HTTP.roundTripTime;
var ttlb = HTTP.rspTimeToLastByte;

if (enableResourceBlacklist) {
    var excludeResources = {
        '/favicon.ico': true,
        '/pixel.gif': true,
        '/pixel%20.gif': true
    };
    
}

// Retrieving location, bucket name, and file
if (uriFragments[1] === undefined) { // bucket is not in domain
    region = uriFragments[3] || 'us-standard';
    bucket = uriFragments[4];
    resource = uriFragments[5];
      
}
else { // bucket is in domain
    region = uriFragments[3] || 'unknown';
    bucket = uriFragments[1];
    resource = '/' + uriFragments[4] + (uriFragments[5] || '');
}
// File Blacklist 
if (enableResourceBlacklist) {
    if (excludeResources[resource]) {
        return;
    }
}

if (syslog) {
    debug('<AWS_CONNECT>METRIC:S3:ProcessTime:' + tprocess + '</AWS_CONNECT>');
    RemoteSyslog.info('<AWS_CONNECT>METRIC:S3:ProcessTime:' + tprocess +
                      '</AWS_CONNECT>');
    RemoteSyslog.info('<AWS_CONNECT>METRIC:S3/' + bucket +
                      ':ProcessTime:' + tprocess + '</AWS_CONNECT>');
}

// Status codes for S3 requests
switch(statusCode) {
    case 200:
        status_message = '200: S3 request successful';
        break;
    case 206:
        status_message = '206: S3 request only partially fulfilled';
        break;
    case 301:
        status_message = '301: S3 file requested is in a different region';
        break;
    case 304:
        status_message = '304: Conditional request and content have not been modified';
        break;
    case 307:
        status_message = '307: S3 file may have been temporarily moved';
        break;
    case 403:
        status_message = '403: User has requested forbidden content';
        break;
    case 404:
        status_message = '404: File does not exist';
        break;
    case 500:
        status_message = '500: Amazon S3 service is down';
        break;
}

if (enablePerBucketApplications) {
    bucketApp = Application('AWS S3: ' + bucket);
}

// Metric Creation for Status Codes
if (status_message) {
    app.metricAddCount('statusCode', 1);
    app.metricAddDetailCount('statusCode', status_message, 1);

    // Concatenates File & Status Code
    app.metricAddDetailCount("File | Status Code",
                             "File: " + resource +
                             " | Status Code: " + status_message, 1);

    app.metricAddDetailCount("File | Status Code | Client",
                             "File: " + resource +
                             " | Status Code " + status_message +
                             " | Client " + client, 1);

    // Bucket | File | Status Code
    app.metricAddDetailCount("Bucket | File | Status Code",
                             "Bucket: " + bucket + " | File: " + resource +
                             " | Status Code " + status_message, 1);
    // Bucket | File | Status Code | Client
    app.metricAddDetailCount("Bucket | File | Status Code | Client",
                             "Bucket: " + bucket + " | File: " + resource +
                             " | Status Code " + status_message +
                             " | Client " + client, 1);

    Device.metricAddCount('statusCode', 1);
    Device.metricAddDetailCount('statusCode', status_message, 1);
    //Concatenates File & Status Code
    Device.metricAddDetailCount("File | Status Code",
                                "File: " + resource +
                                " | Status Code " + status_message, 1);
    // Bucket | File | Status Code
    Device.metricAddDetailCount("Bucket | File | Status Code",
                                "Bucket: " + bucket + " | File: " + resource +
                                " | Status Code " + status_message, 1);

    if (bucketApp !== null) {
        bucketApp.metricAddCount('statusCode', 1);
        bucketApp.metricAddDetailCount('statusCode', status_message, 1);
    }
}

// File Count
app.metricAddCount('s3_file', 1);
app.metricAddDetailCount('s3_file_detail', resource, 1);

//Client 
app.metricAddDetailCount('S3 Clients', client, 1); 


// Heatmap
app.metricAddDataset('s3_file', ttlb);
app.metricAddDetailDataset('s3_ttlb_per_file_detail', resource, ttlb);

Device.metricAddDataset('s3_file_device', ttlb);
Device.metricAddDetailDataset('s3_ttlb_per_file_detail_device', resource, ttlb);

// TTLB (Time to Last Byte) Time Graph
app.metricAddSampleset('s3_ttlb', ttlb);
app.metricAddDetailSampleset('s3_ttlb_per_file_detail', resource, ttlb);

// RTT Time Graph. 
app.metricAddSampleset('s3_rtt', rtt);
app.metricAddDetailSampleset('s3_rtt_per_file_detail', resource, rtt);

// Bucket Transaction Metrics
app.metricAddDetailCount('s3_bucket_transaction_detail', bucket, 1);
app.metricAddDetailSampleset('s3_tprocess_per_bucket_detail', bucket, tprocess);
app.metricAddDetailSampleset('s3_rtt_per_bucket_detail', bucket, rtt);

// Heatmap for Bucket
app.metricAddDetailDataset('s3_bucket_transaction_detail', bucket, 1);
app.metricAddDetailDataset('s3_tprocess_per_bucket_detail', bucket, tprocess);

// Location Transaction Metrics
app.metricAddDetailCount('s3_requests_per_location', region, 1);
app.metricAddDetailSampleset('s3_tprocess_per_location', region, tprocess);
app.metricAddDetailSampleset('s3_rtt_per_location', region, rtt);

app.metricAddCount('s3_method', 1);
app.metricAddDetailCount('s3_method_detail', method, 1);

app.commit();

//Calculating Bytes Transferred to and from Amazon S3 Services 
if (bucket) {
    //Getting Files to S3 
    if (statusCode !== 404) {
        var bytesOut = HTTP.rspBytes;
        app.metricAddCount('aws-s3out-bytes', bytesOut);
        app.metricAddDetailCount('aws-s3out-bytes-detail', method, bytesOut);
        app.metricAddDetailCount('File', resource  , bytesOut); 
        Device.metricAddCount('aws-s3out-bytes', bytesOut);
        Device.metricAddDetailCount('aws-s3out-bytes-detail', method, bytesOut);
    
        //Pushing Files to S3
        var bytesIn = HTTP.reqBytes;
        app.metricAddCount('aws-s3in-bytes', bytesIn);
        app.metricAddDetailCount('aws-s3in-bytes-detail', method, bytesIn);
        Device.metricAddCount('aws-s3in-bytes', bytesIn);
        Device.metricAddDetailCount('aws-s3in-bytes-detail', method, bytesIn);
       if (bucketApp !== null) {  
         //Bytes In and Out Per Bucket 
        bucketApp.metricAddCount('aws-bucket-s3out-bytes', bytesOut); 
        bucketApp.metricAddCount('aws-bucket-s3in-bytes', bytesIn);
       }
    }

    app.metricAddDetailCount('s3_requests_per_bucket', bucket, 1);
    app.metricAddDetailDataset('s3_requests_per_bucket', bucket, 1);
    app.metricAddDetailSampleset('s3_tprocess_per_bucket', bucket, tprocess);
    
    app.metricAddDetailCount("Bucket | File | Bytes requested from S3",
                             "Bucket:" + bucket +
                             " | File: " + resource +
                             " | Bytes requested from S3: " + bytesOut, 1);

    // Bucket | File | Bytes requested from S3 | Client
    app.metricAddDetailCount("Bucket | File | Bytes requested from S3 | Client",
                             "Bucket:" + bucket +
                             " | File: " + resource +
                             " | Bytes requested from S3: " + bytesOut +
                             " | Client:" + client, 1);

    app.metricAddDetailCount("Bucket | File | Bytes uploaded to S3 ",
                             "Bucket:" + bucket +
                             " | File: " + resource +
                             " | Bytes uploaded to S3: " + bytesIn, 1);

    if (bucketApp !== null) { 
        // Bucket Process Time
        bucketApp.metricAddDataset('s3_total_tprocess', tprocess);
        bucketApp.metricAddDetailSampleset('s3_tprocess_per_bucket', bucket, tprocess);
        bucketApp.metricAddDetailCount('s3_file_detail', resource, 1);
        bucketApp.metricAddDetailSampleset('s3_ttlb_per_file_detail', resource, ttlb);
        
        //File Transfer Time
        bucketApp.metricAddDataset('s3_file', ttlb);
        bucketApp.metricAddDetailDataset('s3_ttlb_per_file_detail', resource, ttlb);
          
        // Bucket RTT
        bucketApp.metricAddSampleset('s3_rtt', rtt);
        bucketApp.metricAddDetailSampleset('s3_rtt_per_file_detail', resource, rtt);
        bucketApp.metricAddDetailSampleset('s3_rtt_per_bucket_detail', bucket, rtt);

        bucketApp.metricAddCount('s3_total_requests_per_bucket', 1);
        bucketApp.metricAddDetailCount('s3_requests_per_bucket', bucket, 1);

        // Bucket | File | Status Code
        bucketApp.metricAddDetailCount("File | Status Code",
                            "File: " + resource +
                            " | Status Code: " + status_message, 1);
        // Bucket | File | Status Code | Client
        bucketApp.metricAddDetailCount("File | Status Code | Client",
                             "File: " + resource +
                             " | Status Code: " + status_message +
                             " | Client: " + client, 1);


        bucketApp.commit();
    }

    // Device Level stats
    Device.metricAddCount('s3_bucket', 1);
    Device.metricAddDetailCount('s3_bucket', bucket, 1);
    Device.metricAddDetailCount('s3_resource', resource, 1);
    Device.metricAddDetailCount('s3_region', region, 1);
    Device.metricAddDetailCount('s3_method_detail', method, 1);
    Device.metricAddSampleset('s3_tprocess_per device', tprocess);
    Device.metricAddSampleset('s3_ttlb_per device', ttlb);
    Device.metricAddDetailSampleset('s3_tprocess_per_bucket', bucket, tprocess);
    Device.metricAddDetailSampleset('s3_ttlb_per_resource', resource, ttlb);
    Device.metricAddSampleset('s3_rtt_per device', rtt);
    Device.metricAddDetailSampleset('s3_rtt_per_bucket', bucket, rtt);
    Device.metricAddDetailSampleset('s3_rtt_per_resource', resource, rtt);
    Device.metricAddDetailCount("Bucket | File | Bytes Requested from S3",
                                "Bucket:" + bucket +
                                " | File: " + resource +
                                " | Requested Bytes from S3: " + bytesOut, 1);
    Device.metricAddDetailCount("Bucket | File | Bytes Uploaded to S3",
                                "Bucket:" + bucket +
                                " | File: " + resource +
                                " | Requested Bytes from S3: " + bytesIn, 1);
    
}
