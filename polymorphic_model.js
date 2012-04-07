steal(
    './associative_model'
).then(function() {

    function isId(id) {
        return typeof id == 'string' || typeof id == 'number';
    }

    var classNames = {};

    var associativeModelSetup = can.Model.AssociativeModel.setup;
    can.Model.AssociativeModel.setup = function() {
        associativeModelSetup.apply(this, arguments);
        if (this == can.Model.AssociativeModel) return;

        classNames[this.shortName] = this;

        if (this.associations) {
            for (var type in this.associations) {
                for (var i = 0; i < this.associations[type].length; ++i) {
                    var association = this.associations[type][i];
                    if (association.polymorphic && type == "belongsTo") {
                        belongsTo(this, association);
                    } else if (association.as && type == "hasMany") {
                        //hasMany(this, association);
                    }
                }
            }
        }
    };

    function belongsTo(self, association) {
        var name = association.name,
            cap = can.classize(name),
            oldSet = self.prototype["set"+cap],
            oldSetId = self.prototype["set"+cap+"Id"],
            idName = name+"_id",
            typeName = name+"_type";


        self.prototype["set"+cap] = function(v) {
            if (isId(v)) throw "Can not use id for polymorphic relationship";

            var newItem = null;

            if (v) {
                if (v instanceof can.Model) {
                    newItem = v;
                } else if (v.type) {
                    newItem = classNames[v.type].store[v.id];
                    if (!newItem) return null; // there's chance that the polymorphic object is supplied by the server, but
                    // attr() for that object has not been called yet, so return here to avoid resetting the type and id
                } else if (this[name+"_type"]) {
                    newItem = classNames[this[name+"_type"]].model(v);
                }
                else // attr(polyobj) has been called before attr(polyobj_type), so we store the poly object in the local.
                // when attr(polyobj_type) is called, it will use this object instead of {type, id}
                {
                    this._assocData.tempPolymorphicOjbect = v;
                    return null;
                }
            }

            this._assocData.polyIgnoreId = true;
            this._assocData.polyIgnoreType = true;

            oldSet.apply(this, [newItem]);

            var oldType = this[typeName];
            var newType = null;
            if (newItem) newType = newItem.constructor.shortName;
            if (typeof oldType == "undefined" || oldType != newType)
            {
                this.attr(typeName, newType);
            }

            delete this._assocData.polyIgnoreId;
            delete this._assocData.polyIgnoreType;
        };

        self.prototype["set"+cap+"Id"] = function(id) {
            if (this[idName] === id) return id;
            if (isId(id) && isId(this[idName]) && !this._assocData.polyIgnoreId) throw "Should not use id for polymorphic relationship";

            this[idName] = id;

            var idsDifferent = !this[name] || this[name].id != id;
            if (this[typeName] && (idsDifferent || this[name].constructor.shortName !== this[typeName])) {
                if ((isId(id) && this[typeName]) || (!isId(id) && !this[typeName])) {
                    if (this._assocData.tempPolymorphicOjbect) {
                        this.attr(name, this._assocData.tempPolymorphicOjbect);
                        delete this._assocData.tempPolymorphicOjbect;
                    } else {
                        this.attr(name, {id: id, type: this[typeName]});
                    }
                }
            }

            return this[idName];
        };

        self.prototype["set"+cap+"Type"] = function(polyType) {
            var typeName = name+"_type";
            var idName = name+"_id";
            if (this[typeName] === polyType) return polyType;
            if (polyType && typeof this[typeName]  !== "undefined" && !this._assocData.polyIgnoreType) throw "Should not use type for polymorphic relationship";
            delete this._assocData.polyIgnoreType;

            polyType = polyType ? can.classize(polyType) : polyType;
            this[typeName] = polyType;

            var idsDifferent = !this[name] || this[name].id != this[idName];

            if (this[idName] && (idsDifferent || this[name].constructor.shortName !== polyType)) {
                if ((polyType && isId(this[idName])) || (!polyType && !isId(this[idName])))
                {
                    if (this._assocData.tempPolymorphicOjbect)
                    {
                        this.attr(name, this._assocData.tempPolymorphicOjbect);
                        delete this._assocData.tempPolymorphicOjbect;
                    }
                    else
                    {
                        this.attr(name, {id: this[idName], type: polyType});
                    }
                }
            }

            return this[typeName];

        }
    }

});