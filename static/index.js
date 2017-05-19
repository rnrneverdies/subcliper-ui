(function(){

// settings
var baseUrl = 'https://amsfunctionssample7nvl3wurg4tuk.azurewebsites.net/';
var assetsUrl = baseUrl + 'api/assets';
var baseAssetUrl = baseUrl + 'api/assets/';
var subclipsUrl = baseUrl + 'api/subclips';
var refreshInterval = 5000; // 10 seconds

// state store
var jobsInProgress = [];

// initialize
var keyboadShortcutConfig = new AMVE.AdobePremierProShortcutConfig();
var playerOptions = {
    nativeControlsForTouch: false,
    autoplay: true,
    controls: true,
    poster: '',
    plugins: {
        AMVE: { containerId: 'amve', clipdataCallback: onClipdataCallback, keyboardShortcutConfig: keyboadShortcutConfig }
    }
};

// initilization
$(function() {
    // load settings
    $.getJSON('/config.json', function(data) {

        console.log(data, data.baseUrl);

        baseUrl = data.baseUrl;
        assetsUrl = baseUrl + 'api/assets';
        baseAssetUrl = baseUrl + 'api/assets/';
        subclipsUrl = baseUrl + 'api/subclips';

        // initialize Azure Media Player + Azure Media Video Editor
        amp('ampEditor', playerOptions);

        var table = $('table').DataTable({
            serverSide: true,
            processing: true,
            ajax: function (data, callback, settings) {
                data = JSON.parse(data);
                console.log(data, callback, settings);
                $.getJSON( assetsUrl + '?skip=' + data.start + '&take=' + data.length,
                    function (data) {
                        data.recordsTotal = 15;
                        callback(data);
                    }
                );
            },
            rowCallback: rowCallback,
            iDisplayLength: 10,
            columns: [
                { data: 'Name' },
                { data: 'Type' },
                { data: 'Files', render: function(d) { return (d || []).length; } },
                { data: 'Files', render: totalSize },
                { data: null, className: 'right aligned' }
            ]
        });

        // self update
        setInterval( function () {
            table.ajax.reload( null, false );
            console.log('reload');
        }, refreshInterval);

        function totalSize(data) {
            return formatBytes(
                (data || []).reduce(function(prev, actual) {
                    return prev + actual.Size;
                }, 0)
            );
        }

        function rowCallback(row, data, index) {
            var buttons = '<div class="ui icon basic buttons">' +
                    '<a class="ui button item" data-download-asset="' + data.Id + '"><i class="cloud download icon"></i></a>';
            if (data.BaseStreamingUrl) {
                buttons += '<a class="ui button item" data-edit-asset="' + data.Id + '"><i class="edit icon"></i></a>';
            }
            buttons += '</div></td></tr>';

            $('td:eq(4)', row).html(buttons);
        }
    });
});

// click event handlers

$(document).on('click', 'a[data-download-asset]', function() {
    var that = this,
        assetId = $(this).data('download-asset'),
        old = $(this).html(),
        url = baseAssetUrl + encodeURIComponent(assetId.substring('nb:cid:UUID:'.length));

    $(this).html('<div class="ui active inline mini loader"></div>');

    $.getJSON(url, function(asset) {
        console.log(asset);
        $(that).html(old);
        alert('not yet implemented');
    });
});

$(document).on('click', 'a[data-edit-asset]', function() {
    var that = this,
        assetId = $(this).data('edit-asset'),
        oldState = $(this).html(),
        url = baseAssetUrl + encodeURIComponent(assetId.substring('nb:cid:UUID:'.length));

    $(this).html('<div class="ui active inline mini loader"></div>');

    $.getJSON(url, function(asset) {
        console.log(asset);

        $(that).html(oldState);
        $('#editor').removeAttr('style');

        var player = amp('ampEditor');
        player.editingAssetId = assetId;
        player.ready(function() {
            player.src([{ src: asset.BaseStreamingUrl, type: 'application/dash+xml' }]);
        });
    });
});

$(document).keyup(function(e) {
  // esc handler
  if (e.keyCode === 27) $('#btnCloseEditor').click();
});

$(document).on('click', '#btnCloseEditor', function() {
    amp('ampEditor').pause();
    $('#editor').attr('style', 'opacity: 0; pointer-events: none;');
});

// editor callback functions

function onClipdataCallback(clipData) {

    if (clipData) {
        var data = {
            SourceAssetId: amp('ampEditor').editingAssetId,
            Name: clipData.title,
            Start: clipData.markIn,
            End: clipData.markOut
        };

        $.ajax({
            type: 'POST',
            url: subclipsUrl,
            contentType: 'application/json',
            dataType: 'json',
            data: JSON.stringify(data),
            success: function (response) {
                if (response.JobId) {
                    response.Name = clipData.title;
                    jobsInProgress.push(response);
                }
            },
            error: function(xhr, error) {
                console.log('error', error);
            }
        });
    }
}

// formating helper functions

function formatBytes(bytes,decimals) {
    if(bytes === 0) return '0 Bytes';
    var k = 1000,
        dm = decimals || 2,
        sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
        i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

})();