steal(
    "./utils.js",
    "can/model",
    "can/assoc/associative_list.js",
    "can/observe/setter"
).then(function() {
    var List = can.Model.AssociativeList;

    function isId(id) {
        return typeof id == 'string' || typeof id == 'number';
    }

    can.Model('can.Model.AssociativeModel',
    /* @Static */
    {
        setup: function( superClass , stat, proto) {
            if (this == can.Model.AssociativeModel) return;
            can.Model.setup.apply(this, arguments);
            var self = this;
            can.forEachAssociation(this.associations, function(assocType, association) {
                association.name = self[assocType](association);
            });
        },

        model: function(obj) {
            if (obj instanceof this) return obj;
            else if (isId(obj)) return this.store[obj];
            else return can.Model.model.apply(this, arguments);
        },

        belongsTo: function(association){
            var inverseType = association.type,
                name = association.name || can.underscore( inverseType.match(/\w+$/)[0] ),
                inverseName = typeof association.inverseName == "undefined" ? can.pluralize(this._shortName) : association.inverseName,
                cap = can.classize(name),
                oldSet = this.prototype["set"+cap],
                oldSetId = this.prototype["set"+cap+"Id"],
                idName = name+"_id";

            this.prototype["set"+cap] = function(v) {

                var self = this,
                    oldItem = this[name],
                    oldId = this[idName],
                    inverseClass,
                    newItem = null;


                if (v instanceof can.Model) {
                    inverseClass = v.constructor;
                    newItem = v;
                } else {
                    inverseClass = can.getObject(inverseType);
                    newItem = v ? inverseClass.model(v) : v;
                }


                if (oldSet) oldSet.call(this, newItem);
                else this[name] = newItem;

                // if newItem is null or undefined, than the id should be the same, e.g. story => undefined story_id => undefined
                var newId = isId(v) ? v : newItem ? newItem[newItem.constructor.id] : newItem;
                if (typeof oldId == "undefined" || oldId != newId) {
                    this.attr(idName, newId);
                }

                if (inverseName) {
                    // remove this from the old item inverse relationship
                    if (oldItem && (!newItem || oldItem.id != newItem.id) && oldItem[inverseName]) {
                        oldItem[inverseName].remove(this);
                        oldItem.constructor.unbind("destroyed.belongsTo_"+this._cid);
                        this.constructor.unbind("created.belongsTo_"+oldItem._cid);
                    }

                    // add this to the new items inverse relationship
                    if (newItem) {
                        if (!newItem[inverseName]) newItem.attr(inverseName, new List(newItem, this.constructor, inverseName, name, false, null));

                        // only inverse association if this model is created
                        if (!this.isNew()) {
                            newItem[inverseName].push(this);
                        } else {
                            // wait until created before setting the inverse
                            this.constructor.bind("created.belongsTo_"+newItem._cid, function(event, createdItem) {
                                if (createdItem == self) {
                                    self.constructor.unbind("created.belongsTo_"+newItem._cid);
                                    newItem[inverseName].push(self);
                                }
                            });
                        }

                        // when the item is destroyed remove it from the association
                        inverseClass.bind("destroyed.belongsTo_"+this._cid, function(event, destroyedItem) {
                            if (destroyedItem == newItem) {
                                inverseClass.unbind("destroyed.belongsTo_"+self._cid);
                                self["set"+cap](null);
                            }
                        });
                    }
                }

                // if v is just and ID, then we should listen for a creation
                if (!newItem && isId(v)) {
                    inverseClass.bind("created."+this._cid, function(event, newItem) {
                        inverseClass.unbind("created."+self._cid);
                        if (newItem.id == v) self["set"+cap](newItem);
                    });
                }

                return newItem;
            };

            this.prototype["set"+cap+"Id"] = function(id) {
                var idName = name+"_id";
                if (this[idName] === id) return id;

                if (oldSetId) oldSetId.call(this, id);
                else this[idName] = id;

                // if the id does not match the stored belongsTo, then forward id to belongsTo attr
                if (!this[name] || this[name].id != id) {
                    this.attr(name, id);
                }

                return this[idName];
            };

            return name;
        },

        hasMany: function(association, hasAndBelongsToMany){
            var inverseType = association.type,
                name = association.name || can.pluralize(can.underscore( inverseType.match(/\w+$/)[0] )),
                cap = can.classize(name),
                oldSet =  this.prototype["set"+cap],
                inverseClass,
                inverseName = typeof association.inverseName == "undefined" ?
                    hasAndBelongsToMany ? can.pluralize(this._shortName) : this._shortName :
                    association.inverseName;


            this.prototype["set"+cap] = function(newItems) {
                inverseClass = inverseClass || can.getObject(inverseType);

                // If its initing and the list already exists, that means the children models already created it
                if (!this._init || !this[name]) {
                    if (!this[name]) {
                        var list = new List(this, inverseClass, name, inverseName, hasAndBelongsToMany);
                        if (oldSet) oldSet.call(this, list);
                        else this[name] = list;
                    }
                    this[name].replace(newItems);
                    return this[name];
                } else {
                    return oldSet ? oldSet.call(this, this[name]) : this[name];
                }
            };

            return name;
        },

        hasAndBelongsToMany: function(association)
        {
            return this.hasMany(association, true);
        }
    },
    /* @Prototype */
    {
        setup: function() {
            this._assocData = {};
            can.Model.prototype.setup.apply(this, arguments);
        },

        serialize: function() {
            var serialized = {};

            this.each(function(key, val) {
                if (!(val instanceof can.Observe)) {
                    serialized[key] = val;
                }
            });
            return serialized;
        }
    });
});

