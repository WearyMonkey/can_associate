steal(
    './associative_model'
).then(function() {

    var List = can.Model.AssociativeList,
        orgClassSetup = can.Model.setup;
        
    can.Model.setup = function() {
        var self = this;

        orgClassSetup.apply(this, arguments);

        can.forEachAssociation(this.associations, function(assocType, association) {
            if (association.through && assocType == "hasMany") {
                hasMany(self, association)
            }
        });
    };

    function hasMany(self, association) {
        var type = association.type,
            name = association.name,
            clazz,
            throughName = association.through,
            sourceName = association.source || can.singularize(name),
            cap = can.classize(throughName),
            oldSet = self.prototype[("set" + cap)];

        self.prototype[("set" + cap)] = function(list) {
            var self = this,
                nameSpace = throughName+"_through_"+this._cid,
                oldList = this[throughName];

            clazz = clazz || can.getObject(type);

            list = this[throughName] = oldSet ? oldSet.call(this, list) : list;

            if (oldList != list) {
                if (oldList) {
                    removeThroughs(self, nameSpace, oldList);
                    unwrapModifiers(self, nameSpace, list);
                }
                addThroughs(self, nameSpace, list);
                wrapModifiers(self, nameSpace, list);
            }

            return list;
        };

        association.inverseName = null;

        function wrapModifiers(self, nameSpace, list) {
            $.each(["remove", "push", "removeAll"], function(i, mod) {
                var org = list[mod];
                list[mod] = function() {
                    this.bind("add", function(ev, vias) {
                        addThroughs(self, nameSpace, vias);
                    });
                    this.bind("remove", function(ev, vias) {
                        removeThroughs(self, nameSpace, vias);
                    });
                    unwrapModifiers(self, nameSpace, list);
                    org.apply(this, arguments);
                };
                list[mod].orgFn = org;
            });
        }

        function unwrapModifiers(self, nameSpace, list) {
            $.each(["remove", "push", "removeAll"], function(i, mod) {
                var modified = list[mod];
                if (modified.orgFn) {
                    list[mod] = modified.orgFn;
                }
            });
        }

        function addThroughs(self, nameSpace, throughs) {
            for (var i = 0; i < throughs.length; ++i) {
                addSource(self, nameSpace, throughs[i][sourceName]);
            }
        }

        function removeThroughs(self, nameSpace, throughs) {
            for (var i = 0; i < throughs.length; ++i) {
                throughs[i].unbind(sourceName+"." + nameSpace);
                removeSource(self, nameSpace, throughs[i][sourceName]);
            }
        }

        function addSource(self, nameSpace, sourceInstance) {
            var refcountName = "refCount."+nameSpace,
                refCount;

            if (!sourceInstance) return;

            if (typeof sourceInstance._assocData[refcountName] == "undefined") {
                refCount = sourceInstance._assocData[refcountName] = 1;
            } else {
                refCount = ++sourceInstance._assocData[refcountName];
            }

            if (refCount == 1) {
                if (!self[name]) self.attr(name, new List(this, clazz, name));
                var model = can.getModel(clazz, sourceInstance);
                self[name].push(model);
            }
        }

        function removeSource(self, nameSpace, sourceInstance) {
            var refCount;
            if (!sourceInstance) return;
            refCount = --sourceInstance._assocData["refCount."+nameSpace];
            if (refCount <= 0) {
                sourceInstance.unbind("created."+nameSpace);
                self[name].remove(sourceInstance)
            }
        }
    }
});