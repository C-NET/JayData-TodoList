var onlinedb = onlinedb || {};
var pendingSynchro = false;

(function () {
    document.addEventListener('deviceready', onDeviceReady, false);
})();

function onDeviceReady() {
    $("#message").append("ready");

    $todo.context = new $todo.Types.ToDoContext({ name: 'webSql', databaseName: 'todo' });
    $todo.context.onReady({
        success: updateView,
        error: function () {
            $todo.context = null;
            updateView();
        }
    });

    //debugger;
    // http://localhost:49375/odata
    onlinedb = new $todo.Types.ToDoContext({
        name: 'oData',
        oDataServiceHost: 'http://gpa.cnet/WebAPIDataCollector/odata'
    });
    onlinedb.onReady({
        success: updateViewRemote,
        error: function () {
            $todo.context = null;
            updateViewRemote();
        }
    });
    //onlinedb.onReady(function () {
    //    $("#message").append(" onlinedb-ready");
    //});

    $("#sync").click(synchronizeData);
    $("#refresh").click(updateViewRemote);

    //checkConnection();

    document.addEventListener("offline", onOffline, false);
    document.addEventListener("online", onOnline, false);
}

// Network info
//function checkConnection() {

//    if (navigator.connection == null || typeof (navigator.connection) == 'undefined')
//        return;

//    var networkState = navigator.connection.type;

//    var states = {};
//    states[Connection.UNKNOWN] = 'Unknown connection';
//    states[Connection.ETHERNET] = 'Ethernet connection';
//    states[Connection.WIFI] = 'WiFi connection';
//    states[Connection.CELL_2G] = 'Cell 2G connection';
//    states[Connection.CELL_3G] = 'Cell 3G connection';
//    states[Connection.CELL_4G] = 'Cell 4G connection';
//    states[Connection.CELL] = 'Cell generic connection';
//    states[Connection.NONE] = 'No network connection';

//    $("#networkinfo").append('Connection type: ' + states[networkState]);
//}

function onOffline() {
    $("#networkinfo").html("");
    $("#networkinfo").append('Offline');
    $("#networkinfo").css('background-color', 'red');
    $("#networkinfo").css('color', 'white');
}

function onOnline() {
    $("#networkinfo").html("");
    $("#networkinfo").append('Online');
    $("#networkinfo").css('background-color', 'green');
    $("#networkinfo").css('color', 'white');

    if (pendingSynchro)
        synchronizeData();
}

$(document).ready(function () {

    $data.Entity.extend('$todo.Types.ToDoEntry', {
        'Id': { 'key': true, 'type': 'Edm.Guid', 'nullable': false, 'required': false },
        'Data': { 'type': 'Edm.String', 'nullable': false, 'required': true },
        'Synchronized': { 'type': 'Edm.Boolean', 'nullable': true, 'required': false },
        'CreationDateTime': { 'type': 'Edm.DateTime', 'nullable': true, 'required': false },
        'ModificationDateTime': { 'type': 'Edm.DateTime', 'nullable': true, 'required': false },
        'Done': { 'type': 'Edm.Boolean', 'nullable': true, 'required': false }
    });

    $data.EntityContext.extend('$todo.Types.ToDoContext', {
        Todo: { type: $data.EntitySet, elementType: $todo.Types.ToDoEntry }
    });

    $('#btnAdd').click(function () {
        var value = $('#txtNew').val();
        if (!value) return;
        var now = new Date();
        //JayData code begins here
        var entity = new $todo.Types.ToDoEntry({ Id: $data.createGuid(), Data: value, Synchronized: false, CreationDateTime: now, ModificationDateTime: now, Done: false });
        $todo.context.Todo.add(entity);
        $todo.context.saveChanges(updateView);
        //$todo.context.Todo.length(function (cnt) { alert("There are " + cnt + " person(s) in the database."); });
        $('#btnAdd').attr("disabled", true); // TODO: por falla en comando $batch (OData) deshabilito poder sincronizar mas de un item a la vez
    });

    $('#btnClear').click(function () {
        $('#todoList > div').each(function () {
            var entity = $(this).data('entity');
            $todo.context.Todo.remove(entity);
        });
        $todo.context.saveChanges(updateView);
        $('#btnAdd').attr("disabled", false);
    });

    $('#todoList').on('click', ':button', function (e) {
        var cmd = $(this).val();
        var entry = $(this).parent().data('entity');
        switch (cmd) {
            case 'undone':
            case 'done':
                $todo.context.Todo.attach(entry);
                entry.Done = (cmd == 'done');
                break;
            case 'delete':
                $todo.context.Todo.remove(entry);
                $('#btnAdd').attr("disabled", false);
                break;
        }
        $todo.context.saveChanges(updateView);
    });

    $('#remoteList').on('click', ':button', function (e) {
        var cmd = $(this).val();
        var entry = $(this).parent().data('entity');
        switch (cmd) {
            case 'delete':
                onlinedb.Todo.remove(entry);
                break;
        }
        onlinedb.saveChanges(updateViewRemote);
    });

});

function updateView() {
    if ($todo.context) {
        $('#wrapper>div:not(#providerSelection)').show();
        $todo.context.Todo.toArray(function (items) {
            $('#todoList').empty();
            items.forEach(function (entity) {
                $('#todoEntryTemplate').tmpl(entity).data('entity', entity).appendTo('#todoList');
            });
        });
    } else {
        $('#wrapper>div:not(#providerSelection)').hide();
    }
}

function updateViewRemote() {
    if (onlinedb) {
        $('#wrapper>div:not(#providerSelection)').show();
        onlinedb.Todo.toArray(function (items) {
            $('#remoteList').empty();
            items.forEach(function (entity) {
                $('#remoteListTemplate').tmpl(entity).data('entity', entity).appendTo('#remoteList');
            });
        });
    } else {
        $('#wrapper>div:not(#providerSelection)').hide();
    }
}

function synchronizeData() {

    if (navigator.connection == null || typeof (navigator.connection) == 'undefined') {
        $("#message").html("Sincronizaci&oacute;n pendiente");
        pendingSynchro = true;
        return;
    }

    var networkState = navigator.connection.type;

    if (networkState == Connection.UNKNOWN || networkState == Connection.NONE) {
        $("#message").html("Sincronizaci&oacute;n pendiente");
        pendingSynchro = true;
        return;
    }

    $todo.context
        .Todo
        .filter("it.Synchronized === false")
        .toArray(function (todoItems) {
            onlinedb.addMany(todoItems);
            onlinedb.saveChanges(function () {
                $("#message").html("Item sincronizado ");
                todoItems.forEach(function (todoItem) {
                    $("#message").append(todoItem.Data);
                    $todo.context.Todo.attach(todoItem);
                    todoItem.Synchronized = true;
                });
                $todo.context.saveChanges(function () {
                    updateView();
                    updateViewRemote();
                });
                pendingSynchro = false;
            });
        })
}


