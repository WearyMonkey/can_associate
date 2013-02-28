steal(
    './associative_model'
).then(function() {

    var List = can.Model.AssociativeList;

    can.AssocFactories.push({
        hasMany: function(self, association) {
            if (!association.through) return;

            var type = association.type,
                name = association.name,
                clazz,
                throughName = association.through,
                sourceName = association.source || can.singularize(name),
                cap = can.classize(throughName),
                oldSet = self.prototype[("set" + cap)];

            self.prototype[("set" + cap)] = function(list) {
                var self = this,
                    oldList = this[throughName];

                clazz = clazz || can.getObject(type);

                list = this[throughName] = oldSet ? oldSet.call(this, list) : list;

                if (oldList != list) {
                    if (oldList) {
                        removeThroughs(self, oldList);
                        unwrapModifiers(self, list);
                    }
                    addThroughs(self, list);
                    wrapModifiers(self, list);
                }

                return list;
            };

            association.inverseName = null;

            function wrapModifiers(self, list) {
                $.each(["remove", "push", "removeAll"], function(i, mod) {
                    var org = list[mod];
                    list[mod] = function() {
                        this.bind("add", function(ev, vias) {
                            addThroughs(self, vias);
                        });
                        this.bind("remove", function(ev, vias) {
                            removeThroughs(self, vias);
                        });
                        unwrapModifiers(self, list);
                        org.apply(this, arguments);
                    };
                    list[mod].orgFn = org;
                });
            }

            function unwrapModifiers(self, list) {
                $.each(["remove", "push", "removeAll"], function(i, mod) {
                    var modified = list[mod];
                    if (modified.orgFn) {
                        list[mod] = modified.orgFn;
                    }
                });
            }

            function addThroughs(self, throughs) {
                for (var i = 0; i < throughs.length; ++i) {
                    addSource(self, throughs[i][sourceName]);
                }
            }

            function removeThroughs(self, throughs) {
                for (var i = 0; i < throughs.length; ++i) {
                    removeSource(self, throughs[i][sourceName]);
                }
            }

            function addSource(self, sourceInstance) {
                if (!sourceInstance) return;

                var refcountName = "refCount."+getKey(sourceInstance),
                    refCount;


                if (typeof self._assocData[refcountName] == "undefined") {
                    refCount = self._assocData[refcountName] = 1;
                } else {
                    refCount = ++self._assocData[refcountName];
                }

                if (refCount == 1) {
                    if (!self[name]) self.attr(name, new List(this, clazz, name));
                    var model = can.getModel(clazz, sourceInstance);
                    self[name].push(model);
                }
            }

            function removeSource(self, sourceInstance) {
                var refCount;
                if (!sourceInstance) return;
                refCount = --self._assocData["refCount."+getKey(sourceInstance)];
                if (refCount <= 0) {
                    self[name].remove(sourceInstance)
                }
            }

            function getKey(model) {
                return model.constructor.shortName + "|" + (model[model.constructor.id] || model._cid);
            }
        }
    });
});