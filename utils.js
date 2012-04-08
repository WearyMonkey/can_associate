steal(
    'can/observe'
).then(function() {
    can.pluralize = function(str)
    {
        var ch = str[str.length-1];
        if (ch == 's')
        {
            return str + 'es';
        }
        else if (ch == 'y')
        {
            return str.substr(0, str.length-1) + 'ies';
        }
        else
        {
            return str + 's';
        }
    };

    can.singularize = function(str) {
        if (/ies$/.test(str))
        {
            return str.substr(0, str.length-3) + 'y';
        }
        else if (/s$/.test(str))
        {
            return str.substr(0, str.length-1);
        }
        else return str;
    };

    can.classize =  function( s , join) {
        // this can be moved out ..
        // used for getter setter
        var parts = s.split(can.undHash),
            i = 0;
        for (; i < parts.length; i++ ) {
            parts[i] = can.capitalize(parts[i]);
        }

        return parts.join(join || '');
    },

    can.forEachAssociation = function(associations, callback) {
        if (associations) {
            for (var assocType in associations) {
                associations[assocType] = can.makeArray(associations[assocType]);
                for (var i = 0; i < associations[assocType].length; ++i) {
                    var association = associations[assocType][i];
                    if (typeof association != 'object') {
                        association = associations[assocType][i] = {type: association}
                    }
                    callback(assocType, association);
                }
            }
        }
    }
});