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
    });

    $('#btnClear').click(function () {
        $('#todoList > div').each(function () {
            var entity = $(this).data('entity');
            $todo.context.Todo.remove(entity);
        });
        $todo.context.saveChanges(updateView);
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
                break;
        }
        $todo.context.saveChanges(updateView);
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

    $todo.context
        .Todo
        .filter("it.Synchronized === false")
        .toArray(function (todoItems) {
            onlinedb.addMany(todoItems);
            onlinedb.saveChanges(function () {
                todoItems.forEach(function (todoItem) {
                    $todo.context.Todo.attach(todoItem);
                    todoItem.Synchronized = true;
                });
                $todo.context.saveChanges(function () {
                    updateView();
                    updateViewRemote();
                });
            });
        })
}


