steal(
    "./utils.js",
    "./associative_list.js",
    "can/model",
    "can/observe/setter"
).then(function() {
    var List = can.Model.AssociativeList,
        orgClassSetup = can.Model.setup,
        orgSetup = can.Model.prototype.setup,
        orgAttr = can.Model.prototype.attr,
        orgSave = can.Model.prototype.save,
        orgModels = can.Model.models,
        tmpCache = null;

    can.extend(can.Model, {
        setup: function( superClass , stat, proto) {
            orgClassSetup.apply(this, arguments);
            this.indexAttrs = this.indexAttrs || [this.id];
        }
    });

    can.getModel = function(clazz, obj, create) {
        var cached;
        if (obj instanceof clazz) {
            return obj;
        } else if (typeof obj != "object") {
            return getModelFromAttrs(clazz, tmpCache, {id: obj})
        } else if (cached = getModelFromAttrs(clazz, tmpCache, obj)) {
            cached.attr(obj);
            return cached;
        } else {
            return create !== false ? clazz.model.call(clazz, obj) : null;
        }
    };

    can.extend(can.Model.prototype, {

        setup: function(attributes) {
            this._assocData = {};
            return orgSetup.call(this, attributes);
        },

        attr: function(attributes) {
            var self = this,
                first = false,
                clazz = this.constructor;

            setupAssociations(clazz);

            if (typeof attributes == "object") {

                if (!tmpCache) {
                    first = true;
                    tmpCache = {};
                }

                setAttrCaches(clazz, tmpCache, attributes, this);

                var result = orgAttr.call(this, attributes),
                    waiting = getClassCache(clazz, tmpCache)._waiting;

                can.each(clazz.indexAttrs, function(attr) {
                    var queue = waiting && waiting[attr] && waiting[attr][self[attr]];
                    if (queue) for (var i = 0; i < queue.length; ++i) queue[i](self);
                });

                if (first) {
                    tmpCache = null;
                }

                return result;
            } else {
                return orgAttr.apply(this, arguments);
            }
        },

        save: function(attributes) {
            var self = this,
                saveCache = this._saveCache = {},
                orgSerialize = R7.Models.Roam7Model.prototype.serialize;

            R7.Models.Roam7Model.prototype.serialize = function() {
                var attrs = orgSerialize.apply(this, arguments);
                setAttrCaches(this.constructor, saveCache, attrs, this);
                return attrs;
            };

            var result = orgSave.apply(this, arguments).always(function() {
                delete self._saveCache;
            });

            R7.Models.Roam7Model.prototype.serialize = orgSerialize;

            return result;
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

    function getModelFromAttrs(clazz, cache, attributes) {
        if (!attributes || !cache) return null;

        var clazzCache = getClassCache(clazz, cache);

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

        var clazzCache = getClassCache(clazz, cache);

        for (var i = 0; i < clazz.indexAttrs.length; ++i) {
            var attr = clazz.indexAttrs[i],
                value = attributes[attr];

            if (!value) continue;

            clazzCache[attr] = clazzCache[attr] || {};
            clazzCache[attr][value] = model;
        }
    }

    function setupAssociations(clazz) {
        if (!clazz._assocsSetup) {
            clazz._assocsSetup = true;

            can.forEachAssociation(clazz.associations, function(assocType, association) {
                can.each(can.AssocFactories, function(factory) {
                    if (factory[assocType]) factory[assocType](clazz, association);
                });

            });
        }
    }

    can.AssocFactories = [{
        belongsTo : function(clazz, association) {
            var inverseType = association.type,
                name = association.name,
                cachedInverseClass = can.getObject(inverseType),
                setName = association.setName,
                oldSet = clazz.prototype[setName];

            if (typeof association.inverseName == "undefined") association.inverseName = can.pluralize(clazz._shortName);

            var newSet = clazz.prototype[setName] = function(value, setId) {
                var self = this,
                    oldItem = this[name],
                    inverseName = association.inverseName,
                    newItem,
                    inverseClass;

                if (value instanceof can.Model) {
                    inverseClass = value.constructor;
                    newItem = value;
                } else {
                    inverseClass = cachedInverseClass;
                    newItem = value ? can.getModel(inverseClass, value) : value;
                }

                if (oldSet) oldSet.call(this, newItem);
                else this[name] = newItem;

                if (inverseClass && setId !== false) {
                    // if newItem is null or undefined, than the id should be the same, e.g. story => undefined story_id => undefined
                    can.each(inverseClass.indexAttrs, function(attr) {
                        var inverseAttr = name + "_" + attr,
                            oldId = self[inverseAttr],
                            newId = newItem ? newItem[attr] : null;

                        if (oldId != newId) {
                            self.attr(inverseAttr, newId);
                        }
                    });
                }

                if (inverseName) {
                    // remove this from the old item inverse relationship
                    if (oldItem && (!newItem || oldItem[inverseClass.id] != newItem[inverseClass.id]) && oldItem[inverseName]) {
                        oldItem[inverseName].remove(this);
                    }

                    // add this to the new items inverse relationship
                    if (newItem) {
                        if (!newItem[inverseName]) newItem.attr(inverseName, new List(newItem, this.constructor, inverseName, name, false, null));
                        newItem[inverseName].push(this);
                    }
                }

                return this[name];
            };


            if (cachedInverseClass) {
                can.each(cachedInverseClass.indexAttrs, function(inverseAttr) {
                    var attr = name + "_" + inverseAttr,
                        setIdName = ("set" + can.classize(attr)),
                        oldSet = clazz.prototype[setIdName];

                    clazz.prototype[setIdName] = function(value) {
                        if (this[attr] === value) return value;

                        if (oldSet) oldSet.call(this, value);
                        else this[attr] = value;

                        // if the value does not match the stored belongsTo, then forward value to belongsTo attr
                        if (!this[name] || this[name][inverseAttr] != value) {
                            var obj = {};
                            obj[inverseAttr] = value;
                            var model = can.getModel(cachedInverseClass, obj, false);
                            newSet.call(this, model, !!model);
                            if (!model) {
                                var self = this,
                                    waiting = getClassCache(cachedInverseClass, tmpCache)._waiting,
                                    done = false;

                                waiting[inverseAttr] = waiting[inverseAttr] || {};
                                var queue = waiting[inverseAttr][value] = waiting[inverseAttr][value] || [];

                                queue.push(function(newItem) {
                                    if (!done) self[setName](newItem);
                                    done = true;
                                });
                            }

                        }

                        return this[attr];
                    };
                })
            }
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
    }];

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

    function getClassCache(clazz, cache) {
        var clazzCache = cache ? cache[clazz._shortName] : {};
        if (!clazzCache) {
            clazzCache = cache[clazz._shortName] = {};
        }
        clazzCache._waiting = clazzCache._waiting || {};
        return clazzCache;
    }
});

