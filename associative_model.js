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

    function associate(associations, Class, type) {
        var relations = $.makeArray( associations[type]);
        associations[type] = relations;
        for(var i=0; i < relations.length;i++) {

            if (typeof relations[i] !== 'object') {
                var name = Class[type]({ type: relations[i] });
                relations[i] = {type: relations[i], name: name};
            } else {
                name = Class[type](relations[i]);
                relations[i].name = name;
            }
        }
        return relations;
    }

    can.Model('can.Model.AssociativeModel',
    /* @Static */
    {
        setup: function( superClass , stat, proto) {
            if (this == can.Model.AssociativeModel) return;
            can.Model.setup.apply(this, arguments);
            if (this.associations) {
                associate(this.associations, this, "hasMany");
                associate(this.associations, this, "belongsTo");
                associate(this.associations, this, "hasAndBelongsToMany");
            }
        },

        model: function(obj) {
            if (obj instanceof this) return obj;
            else if (isId(obj)) return this.store[obj];
            else return can.Model.model.apply(this, arguments);
        },

        belongsTo: function(association){
            var type = association.type,
                name = association.name || can.underscore( type.match(/\w+$/)[0] ),
                inverseName = typeof association.inverseName == "undefined" ? can.pluralize(this._shortName) : association.inverseName,
                cap = can.classize(name),

                set = function(v) {

                    var self = this,
                        oldItem = this[name],
                        clazz,
                        newItem = null;


                    if (v instanceof can.Model) {
                        clazz = v.constructor;
                        newItem = v;
                    } else {
                        clazz = can.getObject(type);
                        newItem = v ? clazz.model(v) : v;
                    }


                    if (orgSet) orgSet.call(this, newItem);
                    else this[name] = newItem;

                    var idName = name+"_id";
                    var oldId = this[idName];
                    // if newItem is null or undefined, than the id should be the same, e.g. story => undefined story_id => undefined
                    var newId = isId(v) ? v : newItem ? newItem[newItem.constructor.id] : newItem;
                    if (typeof oldId == "undefined" || oldId != newId) {
                        this.attr(idName, newId);
                    }

                    if (inverseName) {
                        // remove this from the old item inverse relationship
                        if (oldItem && (!newItem || oldItem.id != newItem.id) && oldItem[inverseName]) {
                            oldItem[inverseName].remove(this);
                            oldItem.constructor.unbind("destroyed.belongsTo_"+this._namespace);
                            this.constructor.bind("created.belongsTo_"+oldItem._namespace);
                        }

                        // add this to the new items inverse relationship
                        if (newItem) {
                            if (!newItem[inverseName]) newItem.attr(inverseName, new List(newItem, this.constructor, inverseName, name, false, null));
                            if (!this.isNew()) {
                                newItem[inverseName].push(this);
                            } else {
                                this.constructor.bind("created.belongsTo_"+newItem._namespace, function(event, createdItem) {
                                    if (createdItem == self) {
                                        self.constructor.unbind("created.belongsTo_"+newItem._namespace);
                                        newItem[inverseName].push(self);
                                    }
                                });
                            }
                            clazz.bind("destroyed.belongsTo_"+this._namespace, function(event, destroyedItem) {
                                if (destroyedItem == newItem) {
                                    clazz.unbind("destroyed.belongsTo_"+self._namespace);
                                    set.call(self, null);
                                }
                            });
                        }
                    }

                    // clean up the handle if it was created before
                    if (this[name+"_handle"]) {
                        clazz.unbind("created."+this._namespace);
                        delete this[name+"_handle"];
                    }

                    // if v is just and ID, then we should listen for a creation
                    if (!newItem && isId(v)) {
                        clazz.bind("created."+this._namespace, function(event, newItem) {
                            if (newItem.id == v) set.call(self, newItem);
                        });
                    }

                    return newItem;
                },
                orgSet = this.prototype["set"+cap],
                orgSetId = this.prototype["set"+cap+"Id"];

            this.prototype["set"+cap] = set;

            this.prototype["set"+cap+"Id"] = function(id) {
                var idName = name+"_id";
                if (this[idName] === id) return id;

                if (orgSetId) orgSetId.call(this, id);
                else this[idName] = id;

                if (!this[name] || this[name].id != id) {
                    this.attr(name, id);
                }

                return this[idName];
            };

            return name;
        },

        hasMany: function(association, hasAndBelongsToMany){
            var type = association.type,
                name = association.name || can.pluralize(can.underscore( type.match(/\w+$/)[0] )),
                inverseName,
                clazz;

            if (typeof association.inverseName == "undefined") {
                inverseName = hasAndBelongsToMany ? can.pluralize(this._shortName) : this._shortName;
            } else {
                inverseName = association.inverseName;
            }

            var cap = can.classize(name);

            var oldSet =  this.prototype["set"+cap];
            this.prototype["set"+cap] = function(newItems) {
                clazz = clazz || can.getObject(type);
                newItems = $.makeArray(newItems);
                var newModels = [];
                for (var i = 0; i < newItems.length; i++) {
                    newModels.push(newItems[i] instanceof can.Model ? newItems[i] : clazz.model(newItems[i]));
                }

                // If its initing and the list already exists, that means the children models already created it
                if (!this._init || !this[name]) {
                    if (!this[name]) {
                        var list = new List(this, clazz, name, inverseName, hasAndBelongsToMany);
                        if (oldSet) oldSet.call(this, list);
                        else this[name] = list;
                    }
                    this[name].replace(newModels);
                    return this[name];
                } else {
                    return oldSet ? oldSet.call(this, this[name]) : this[name];
                }
            };

            var oldGet = this.prototype["get"+cap];
            this.prototype["get"+cap] = function(){
                if (!this[name]) this.attr(name, new List(this, clazz, name, inverseName, hasAndBelongsToMany));
                return oldGet ? oldGet.call(this, this[name]) : this[name];
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

