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

    function getModel(a, clazz) {
        if (a instanceof clazz) return a;
        else if (isId(a)) return clazz.store[a];
        else return clazz.model(a);
    }

    function associate(associations, Class, type) {
        var relations = $.makeArray( associations[type]);
        associations[type] = relations;
        for(var i=0; i < relations.length;i++) {

            if (typeof relations[i] !== 'object') {
                var name = Class[type]({ type: relations[i] });
                relations[i] = {type: relations[i], name: name};
            } else if (relations[i].via) {
                name = Class.via(relations[i]);
                relations[i].name = name;
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
            //this._super(superClass, stat, proto);
            if (this.associations) {
                associate(this.associations, this, "hasMany");
                associate(this.associations, this, "belongsTo");
                associate(this.associations, this, "hasAndBelongsToMany");
            }
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
                        newItem = v ? getModel(v, clazz) : v;
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
                    newModels.push(newItems[i] instanceof can.Model ? newItems[i] : getModel(newItems[i], can.getObject(type)));
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

        via: function(association) {
            var type = association.type;
            var name = association.name || can.pluralize(can.underscore( type.match(/\w+$/)[0] ));
            var clazz;
            var via = association.via;
            var source = association.source || can.singularize(name);
            var setName = "set" + can.classize(via);

            var orgSet = this.prototype[setName];
            this.prototype[setName] = function(list) {
                var self = this;
                var nameSpace = via+"_via_"+this._namespace;
                clazz = clazz || can.getObject(type);

                var oldList = this[via];

                list = this[via] = orgSet ? orgSet.call(this, list) : list;

                if (oldList != list) {
                    if (oldList) removeVias(self, nameSpace, oldList);
                    addVias(self, nameSpace, list);
                    list.bind("add."+nameSpace, function(ev, vias) {
                        addVias(self, nameSpace, vias);
                    });
                    list.bind("remove."+nameSpace, function(ev, vias) {
                        removeVias(self, nameSpace, vias);
                    });
                }

                return list;
            };

            association.inverseName = null;

            this.hasMany(association, false);

            return name;

            function addVias(self, nameSpace, vias) {
                for (var i = 0; i < vias.length; ++i) {
                    (function(via) {
                        var oldSource = via[source];
                        via.bind(source+"." + nameSpace, function(ev, newSource) {
                            removeSource(self, nameSpace, via, oldSource);
                            addSource(self, nameSpace, via, newSource);
                            oldSource = newSource;
                        });
                    })(vias[i]);

                    addSource(self, nameSpace, vias[i], vias[i][source]);

                }
            }

            function removeVias(self, nameSpace, vias) {
                for (var i = 0; i < vias.length; ++i) {
                    vias[i].unbind(source+"." + nameSpace);
                    removeSource(self, nameSpace, vias[i], vias[i][source]);
                }
            }

            function addSource(self, nameSpace, viaInstance, sourceInstance) {
                if (!sourceInstance) return;

                if (typeof sourceInstance._assocData["refs."+nameSpace] == "undefined") {
                    sourceInstance._assocData["refs."+nameSpace] = {};
                    if (!self[name]) self.attr(name, new List(this, clazz, name));
                    self[name].push(getModel(sourceInstance, clazz));
                }
                sourceInstance._assocData["refs."+nameSpace][viaInstance._namespace] = true;
            }

            function removeSource(self, nameSpace, viaInstance, sourceInstance) {
                if (!sourceInstance) return;

                if (sourceInstance._assocData["refs."+nameSpace] && sourceInstance._assocData["refs."+nameSpace][viaInstance._namespace]) {
                    delete sourceInstance._assocData["refs."+nameSpace][viaInstance._namespace];
                    for (var notEmpty in sourceInstance._assocData["refs."+nameSpace]) {break;}
                    if (!notEmpty) {
                        delete sourceInstance._assocData["refs."+nameSpace]
                        self[name].remove(sourceInstance)
                    }
                }

            }
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

