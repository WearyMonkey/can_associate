steal(
    "./utils.js",
    "./associative_list.js",
    "can/model",
    "can/observe/setter"
).then(function() {
    var List = can.Model.AssociativeList,
        orgClassSetup = can.Model.setup,
        orgSetup = can.Model.prototype.setup,
        orgModels = can.Model.models,
        tmpCache = null;

    can.extend(can.Model, {
        setup: function( superClass , stat, proto) {
            if (this == can.Model.AssociativeModel) return;
            orgClassSetup.apply(this, arguments);
            var self = this;
            can.forEachAssociation(this.associations, function(assocType, association) {
                factories[assocType](self, association);
            });
        }
    });

    can.Model.prototype.setup = function(attributes) {
        var first = false,
            clazzName = this.constructor._shortName,
            clazzId = this.constructor.id;

        if (!tmpCache) {
            first = true;
            tmpCache = {};
        }

        this._assocData = {};

        var clazzCache = tmpCache[clazzName] = tmpCache[clazzName] || {};
        if (attributes && attributes[clazzId]) clazzCache[attributes[clazzId]] = this;

        var result = orgSetup.call(this, attributes);

        if (first) {
            tmpCache = null;
        }

        return result;
    };

    can.Model.models = function(objs) {
        var first = false;
        if (!tmpCache) {
            first = true;
            tmpCache = {};
        }

        var result = orgModels.call(this, objs);

        if (first) {
            tmpCache = null;
        }

        return result;
    };

    can.getModel = function(clazz, obj) {
        var clazzName = clazz._shortName;

        if (obj instanceof clazz) return obj;
        else if (tmpCache && tmpCache[clazzName] && can.isId(obj) && tmpCache[clazzName][obj]) return tmpCache[clazzName][obj];
        else return clazz.model.call(clazz, obj);
    };

    var factories = {
        belongsTo : function(clazz, association) {
            var inverseType = association.type,
                name = association.name = association.name || can.underscore( inverseType.match(/\w+$/)[0] ),
                cap = can.classize(name),
                oldSet = clazz.prototype["set"+cap],
                oldSetId = clazz.prototype["set"+cap+"Id"],
                idName = name+"_id";

            if (typeof association.inverseName == "undefined") association.inverseName = $.pluralize(clazz._shortName);

            clazz.prototype["set"+cap] = function(v) {

                var self = this,
                    oldItem = this[name],
                    oldId = this[idName],
                    inverseClass,
                    newItem = null,
                    inverseName = association.inverseName;


                if (v instanceof can.Model) {
                    inverseClass = v.constructor;
                    newItem = v;
                } else {
                    inverseClass = can.getObject(inverseType);
                    newItem = v ? can.getModel(inverseClass, v) : v;
                }


                if (oldSet) oldSet.call(this, newItem);
                else this[name] = newItem;

                // if newItem is null or undefined, than the id should be the same, e.g. story => undefined story_id => undefined
                var newId = can.isId(v) ? v : newItem ? newItem[newItem.constructor.id] : newItem;
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
                if (!newItem && can.isId(v)) {
                    inverseClass.bind("created."+this._cid, function(event, newItem) {
                        inverseClass.unbind("created."+self._cid);
                        if (newItem.id == v) self["set"+cap](newItem);
                    });
                }

                return newItem;
            };

            clazz.prototype["set"+cap+"Id"] = function(id) {
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
        },

        hasMany: function(clazz, association, hasAndBelongsToMany) {
            var inverseType = association.type,
                name = association.name = association.name || can.pluralize(can.underscore( inverseType.match(/\w+$/)[0] )),
                cap = can.classize(name),
                oldSet =  clazz.prototype["set"+cap],
                inverseClass;

            if (typeof association.inverseName == "undefined") {
                association.inverseName = hasAndBelongsToMany ? $.pluralize(clazz._shortName) : clazz._shortName;
            }

            clazz.prototype["set"+cap] = function(newItems) {
                var inverseName = association.inverseName;

                inverseClass = inverseClass || can.getObject(inverseType);

                var newModels = $.map(newItems, function(newItem) {
                    return can.getModel(inverseClass, newItem)
                });

                // If its initing and the list already exists, that means the children models already created it
                if (!this._init || !this[name]) {
                    if (!this[name]) {
                        var list = new List(this, inverseClass, name, inverseName, hasAndBelongsToMany);
                        if (oldSet) oldSet.call(this, list);
                        else this[name] = list;
                    }
                    if (association.replaceType == "merge") {
                        this[name].push(newModels);
                    } else {
                        this[name].replace(newModels);
                    }
                    return this[name];
                } else {
                    if (newModels.length != this[name].length) this[name].push(newModels);
                    return this[name];
                }
            };
        },

        hasAndBelongsToMany: function(clazz, association) {
            return hasMany(clazz, association, true);
        }
    }
});

