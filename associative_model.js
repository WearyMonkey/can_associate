steal(
    "./utils.js",
    "./associative_list.js",
    "can/model",
    "can/observe/setter"
).then(function() {
    var List = can.Model.AssociativeList,
        orgClassSetup = can.Model.setup,
        orgSetup = can.Model.prototype.setup,
        orgSave = can.Model.prototype.save,
        orgModels = can.Model.models,
        tmpCache = null;

    can.extend(can.Model, {
        setup: function( superClass , stat, proto) {
            orgClassSetup.apply(this, arguments);
            var self = this;

            if (this == can.Model) return;

            this.indexAttrs = this.indexAttrs || [this.id];

            can.forEachAssociation(this.associations, function(assocType, association) {
                factories[assocType](self, association);
            });
        }
    });

    function getModelFromAttrs(clazz, cache, attributes) {
        if (!attributes || !cache) return null;

        var clazzCache = cache[clazz._shortName] = (cache[clazz._shortName] || {});

        for (var i = 0; i < clazz.indexAttrs.length; ++i) {
            var attr = clazz.indexAttrs[i],
                value = attributes[attr];

            if (value != null && clazzCache[attr] && clazzCache[attr][value] != null) {
                return clazzCache[attr][value];
            }
        }
        return null;
    }

    function setAttrCaches(clazz, cache, attributes, model) {
        if (!attributes) return;

        var clazzCache = cache[clazz._shortName] = (cache[clazz._shortName] || {});

        for (var i = 0; i < clazz.indexAttrs.length; ++i) {
            var attr = clazz.indexAttrs[i],
                value = attributes[attr];

            if (!value) continue;

            if (typeof value == "string") value = value.toLowerCase();
            clazzCache[attr] = clazzCache[attr] || {};
            clazzCache[attr][value] = model;
        }
    }

    can.getModel = function(clazz, obj) {
        var cached;
        if (obj instanceof clazz) {
            return obj;
        } else if (typeof obj != "object") {
            return getModelFromAttrs(clazz, tmpCache, {id: obj})
        } else if (cached = getModelFromAttrs(clazz, tmpCache, obj)) {
            cached.attr(obj);
            return cached;
        } else {
            return clazz.model.call(clazz, obj);
        }
    };

    can.extend(can.Model.prototype, {
        setup: function(attributes) {
            var first = false;

            if (!tmpCache) {
                first = true;
                tmpCache = {};
            }

            this._assocData = {};

            setAttrCaches(this.constructor, tmpCache, attributes, this);

            var result = orgSetup.call(this, attributes);

            if (first) {
                tmpCache = null;
            }

            if (this[this.constructor.id]) this.created();

            return result;
        },

        save: function(attributes) {
            var self = this,
                saveCache = this._saveCache = {},
                orgSerialize = can.Model.prototype.serialize;

            can.Model.prototype.serialize = function() {
                var attrs = orgSerialize.apply(this, arguments);
                setAttrCaches(this.constructor, saveCache, attrs, this);
            };

            return orgSave.apply(this, arguments).always(function() {
                delete self._saveCache;
            });
        }
    });

    can.each(["updated", "created"], function(method) {
        var org = can.Model.prototype[method];
        can.Model.prototype[method] = function() {
            var orgCache = tmpCache;
            if (this._saveCache) tmpCache = this._saveCache;
            org.apply(this, arguments);
            tmpCache = orgCache;
        }
    });

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

    var factories = {
        belongsTo : function(clazz, association) {
            var inverseType = association.type,
                name = association.name,
                idName = name+"_id",
                setName = association.setName,
                setIdName = setName + "Id",
                cachedInverseClass,
                oldSet = clazz.prototype[setName],
                oldSetId = clazz.prototype[setIdName];

            if (typeof association.inverseName == "undefined") association.inverseName = can.pluralize(clazz._shortName);

            var newSet = clazz.prototype[setName] = function(v) {

                var self = this,
                    oldItem = this[name],
                    oldId = this[idName],
                    inverseName = association.inverseName,
                    newItem,
                    inverseClass;

                if (v instanceof can.Model) {
                    inverseClass = v.constructor;
                    newItem = v;
                } else {
                    inverseClass = cachedInverseClass = (cachedInverseClass ||  can.getObject(inverseType));
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
                                self[setName](null);
                            }
                        });
                    }
                }

                // if v is just and ID, then we should listen for a creation
                if (!newItem && can.isId(v)) {
                    inverseClass.bind("created."+this._cid, function(event, newItem) {
                        if (newItem.id == v) {
                            inverseClass.unbind("created."+self._cid);
                            self[setName](newItem);
                        }
                    });
                }

                return newItem;
            };

            clazz.prototype[setIdName] = function(id) {
                var idName = name+"_id";
                if (this[idName] === id) return id;

                if (oldSetId) oldSetId.call(this, id);
                else this[idName] = id;

                // if the id does not match the stored belongsTo, then forward id to belongsTo attr
                if (!this[name] || this[name].id != id) {
                    newSet.call(this, id); //
                }

                return this[idName];
            };
        },

        hasMany: function(clazz, association, hasAndBelongsToMany) {
            var type = association.type,
                name = association.name,
                setName = association.setName,
                inverseClazz, inverseAssociation,
                oldSet =  clazz.prototype[setName];

            if (typeof association.inverseName == "undefined") {
                association.inverseName = hasAndBelongsToMany ? can.pluralize(clazz._shortName) : clazz._shortName;
            }

            clazz.prototype[setName] = function(newItems) {
                var inverseName = association.inverseName,
                    newModels, oldInverseAssociationInverseName;

                inverseClazz = inverseClazz || can.getObject(type);
                inverseAssociation = inverseAssociation || getInverseAssociation(association, inverseClazz.associations);

                if (newItems.length) {

                    // turn of the child association invserse as we are about to set it anyway
                    if (inverseAssociation) {
                        oldInverseAssociationInverseName = inverseAssociation.inverseName;
                        inverseAssociation.inverseName = null;
                    }

                    newModels = [];
                    for (var i = 0; i < newItems.length; i++) {
                        newModels.push(can.getModel(inverseClazz, newItems[i]));
                    }

                    // make sure we turn the inverse back on again
                    if (inverseAssociation) {
                        inverseAssociation.inverseName = oldInverseAssociationInverseName;
                    }

                } else {
                    newModels = newItems;
                }

                // If its initing and the list already exists, that means the children models already created it
                if (!this._init || !this[name]) {
                    if (!this[name]) {
                        var list = new List(this, inverseClazz, name, inverseName, hasAndBelongsToMany);
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

            return association;
        },

        hasAndBelongsToMany: function(clazz, association) {
            return this.hasMany(clazz, association, true);
        }
    };

    function getInverseAssociation(of, from) {
        for (var type in from) {
            for (var i = 0; i < from[type].length; ++i) {
                var otherAssoc = from[type][i];
                if (otherAssoc.inverseName == of.name && otherAssoc.name == of.inverseName) {
                    return otherAssoc;
                }
            }
        }
        return null;
    }
});

