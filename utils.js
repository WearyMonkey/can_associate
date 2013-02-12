steal(
    'can/observe'
).then(function () {
    can.pluralize = function (str) {
        var ch = str[str.length - 1];
        if (ch == 's') {
            return str + 'es';
        }
        else if (ch == 'y') {
            return str.substr(0, str.length - 1) + 'ies';
        }
        else {
            return str + 's';
        }
    };

    can.singularize = function (str) {
        if (/ies$/.test(str)) {
            return str.substr(0, str.length - 3) + 'y';
        }
        else if (/s$/.test(str)) {
            return str.substr(0, str.length - 1);
        }
        else return str;
    };

    can.isId = function (id) {
        return typeof id == 'string' || typeof id == 'number';
    };

    can.forEachAssociation = function (associations, callback) {
        if (associations) {
            for (var assocType in associations) {
                associations[assocType] = can.makeArray(associations[assocType]);
                for (var i = 0; i < associations[assocType].length; ++i) {
                    var association = associations[assocType][i];
                    if (typeof association != 'object') {
                        association = associations[assocType][i] = {type: association}
                    }

                    if (!association.name) {
                        association.name = can.underscore( association.type.match(/\w+$/)[0] );
                        if (assocType != "belongsTo") association.name = can.pluralize(association.name);
                    }

                    association.setName = association.setName || "set" + can.classize(association.name);

                    callback(assocType, association);
                }
            }
        }
    }
});