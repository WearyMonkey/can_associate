steal(
    './associative_model'
).then(function() {

    var List = can.Model.AssociativeList,
        classNames = {},
        orgClassSetup = can.Model.setup;
        
    can.Model.setup = function() {
        orgClassSetup.apply(this, arguments);

        classNames[this.shortName] = this;

        var self = this;
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

            list = this[throughName] = oldSet.call(this, list);

            if (oldList != list) {
                if (oldList) removeThroughs(self, nameSpace, oldList);
                addThroughs(self, nameSpace, list);
                list.bind("add."+nameSpace, function(ev, throughs) {
                    addThroughs(self, nameSpace, throughs);
                });
                list.bind("remove."+nameSpace, function(ev, throughs) {
                    removeThroughs(self, nameSpace, throughs);
                });
            }

            return list;
        };

        return name;

        function addThroughs(self, nameSpace, throughs) {
            for (var i = 0; i < throughs.length; ++i) {
                (function(through) {
                    var oldSource = through[sourceName];
                    through.bind(sourceName+"." + nameSpace, function(ev, newSource) {
                        removeSource(self, nameSpace, oldSource);
                        addSource(self, nameSpace, newSource);
                        oldSource = newSource;
                    });
                })(throughs[i]);

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
                var model = clazz.model(sourceInstance);
                if (model.isNew()) {
                    model.bind("created."+nameSpace, function() {
                        self[name].push(model);
                    });
                } else {
                    self[name].push(model);
                }
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