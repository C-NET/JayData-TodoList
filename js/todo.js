var onlinedb = onlinedb || {};

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

    onlinedb = new $todo.Types.ToDoContext({
        name: 'oData',
        oDataServiceHost: 'http://localhost:50500/OnlineDB.svc'
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
}

$(document).ready(function () {

    $data.Entity.extend('$todo.Types.ToDoEntry', {
        'Id': { 'key': true, 'type': 'Edm.Guid', 'nullable': false, 'required': true },
        'Data': { 'type': 'Edm.String', 'nullable': false, 'required': true },
        'Synchronized': { 'type': 'Edm.Boolean', 'nullable': false, 'required': true },
        'CreationDate': { 'type': 'Edm.DateTime', 'nullable': false, 'required': true },
        //Id: { type: 'int', key: true, computed: true },
        //'Value': { 'type': 'Edm.String', 'nullable': true, 'required': false },
        //'CreatedAt': { 'type': 'Edm.DateTime', 'nullable': true, 'required': false },
        //'ModifiedAt': { 'type': 'Edm.DateTime', 'nullable': true, 'required': false },
        //'Done': { 'type': 'Edm.Boolean', 'nullable': true, 'required': false }
    });

    $data.EntityContext.extend('$todo.Types.ToDoContext', {
        ItemsSet: { type: $data.EntitySet, elementType: $todo.Types.ToDoEntry }
    });

    $('#btnAdd').click(function () {
        var value = $('#txtNew').val();
        if (!value) return;
        var now = new Date();
        //JayData code begins here
        var entity = new $todo.Types.ToDoEntry({ Id: $data.createGuid(), Data: value, Synchronized: false, CreationDate: now });
        $todo.context.ItemsSet.add(entity);
        $todo.context.saveChanges(updateView);
    });

    $('#btnClear').click(function () {
        $('#todoList > div').each(function () {
            var entity = $(this).data('entity');
            $todo.context.ItemsSet.remove(entity);
        });
        $todo.context.saveChanges(updateView);
    });

    $('#todoList').on('click', ':button', function (e) {
        var cmd = $(this).val();
        var entry = $(this).parent().data('entity');
        switch (cmd) {
            case 'undone':
            case 'done':
                $todo.context.ItemsSet.attach(entry);
                //entry.Done = (cmd == 'done');
                break;
            case 'delete':
                $todo.context.ItemsSet.remove(entry);
                break;
        }
        $todo.context.saveChanges(updateView);
    });

});

function updateView() {
    if ($todo.context) {
        $('#wrapper>div:not(#providerSelection)').show();
        $todo.context.ItemsSet.toArray(function (items) {
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
        onlinedb.ItemsSet.toArray(function (items) {
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

    $todo.context
        .ItemsSet
        .filter("it.Synchronized === false")
        .toArray(function (todoItems) {
            onlinedb.addMany(todoItems);
            onlinedb.saveChanges(function () {
                todoItems.forEach(function (todoItem) {
                    $todo.context.ItemsSet.attach(todoItem);
                    todoItem.Synchronized = true;
                });
                $todo.context.saveChanges(function () {
                    updateView();
                    updateViewRemote();
                });
            });
        })
}


