steal(
    'can/model/list'
).then(function() {

    function getArgs(args) {
        if (args[0] && can.isArray(args[0])) {
            return args[0];
        } else if (args[0] && typeof args[0].length != "undefined") {
            return $.makeArray(args[0]);
        } else {
            return $.makeArray(args);
        }
    }

    function getModel(self, a) {
        if (a instanceof can.Model) return a;
        return self.containedClass.model(a);
    }

    var splice = [].splice;
    var pop = [].pop;

    can.Model.List("can.Model.AssociativeList",
    {

    },
    {
        setup: function(ownerModel, containedClass, name, inverseName, hasAndBelongsToMany) {
            var self = this,
                args = Array.prototype.slice.call(arguments, 6);
            can.Observe.List.prototype.setup.apply(this, args);

            this.containedClass = containedClass;
            this.namespaceToIndex = {};

            this.addRelationShip = function(newItem) {
                if (!inverseName) return;
                if (ownerModel.isNew()) {
                    ownerModel.bind("created."+newItem._cid, function() { self.addRelationShip(newItem) });
                }
                else if (hasAndBelongsToMany) {
                    if (!newItem[inverseName]) {
                        newItem[inverseName] = new self.constructor(newItem, ownerModel.constructor, inverseName, name, true);
                    }
                    newItem[inverseName].push(ownerModel);
                } else {
                    if (!newItem[inverseName] || newItem[inverseName] != ownerModel) {
                        newItem.attr(inverseName, ownerModel);
                    }
                }
            };

            this.removeRelationShip = function(oldItem) {
                if (!inverseName) return;
                ownerModel.unbind("created."+oldItem._cid);
                if (hasAndBelongsToMany) {
                    if (oldItem[inverseName]) oldItem[inverseName].remove(ownerModel);
                } else {
                    if (oldItem[inverseName] && oldItem[inverseName] == ownerModel) {
                        oldItem.attr(inverseName, null);
                    }
                }
            };

            this.bind('change', function(ev, how) {
                if (/\w+\.destroyed/.test(how)) {
                    self.remove(ev.target);
                }
            })
        },

        push: function() {
            var args = getArgs(arguments),
                oldLength = this.length,
                i;

            for (i = 0; i < args.length; i++) {
                var model = args[i] = getModel(this, args[i]),
                    namespace = model._cid;

                if (this.namespaceToIndex[namespace] >= 0) {
                    args.splice(i, 1);
                } else {
                    this.namespaceToIndex[namespace] = oldLength++;
                    this.addRelationShip(model);
                }
            }

            if (args.length) {
                can.Model.List.prototype.push.apply(this, args);
            }

            return this.length;
        },

        /**
                * @function remove the models from the association list
                * @params the models to remove from the list
                */
        remove: function() {
            if (!this.length) {
                return [];
            }

            var args = getArgs(arguments),
                list = [];

            for (var i = 0; i < args.length; ++i) {
                var index = this.indexOf(args[i]),
                    found = null;

                if (index == this.length - 1) {
                    found = pop.call(this);
                } else if (index < this.length - 1) {
                    found = this[index];
                    this[index] = pop.call(this);
                    this.namespaceToIndex[this[index]._cid] = index;
                }

                if (found) {
                    this._changed = true;
                    delete this.namespaceToIndex[found._cid];
                    this.removeRelationShip(found);
                    list.push(found);
                }
            }

            var ret = new $.Model.List(list);
            if (ret.length) {
                $([this]).trigger("remove", [ret])
            }

            return ret;
        },

        /**
                * @function remove all the models from the association list
                */
        removeAll: function() {
            var list = splice.call(this, 0, this.length);

            this.namespaceToIndex = {};
            for (var i = 0; i < list.length; i++) this.removeRelationShip(list[i]);

            var ret = new $.Model.List(list);
            if (ret.length) {
                $([this]).trigger("remove", [ret])
            }

            return ret;
        },

        /**
                * @function Replaces the contents of the list with model arguments. Does not remove (fire events)
                * models in common. If the added models are the same as the models already contained in the list
                * no events are fired.
                * @params the models to the list will only contain
                */
        replace: function() {
            // check for the already empty case
            if (this.length == 0) {
                return this.push.apply(this, arguments);
            }
            var args = getArgs(arguments);
            // check for the removing everything case
            if (args.length == 0) {
                return this.removeAll();
            }

            var toAdd = [];

            var toRemoveModels = $.extend({}, this.namespaceToIndex);

            for (var i = 0; i < args.length; i++) {
                var model = getModel(this, args[i]);
                if (toRemoveModels[model._cid] >= 0) {
                    delete toRemoveModels[model._cid];
                } else {
                    toAdd.push(model)
                }
            }

            var self = this;
            var toRemove = $.map(toRemoveModels, function(index) { return self[index]});

            if (toRemove.length == this.length) this.removeAll();
            else this.remove(toRemove);

            return this.push(toAdd);
        },

        /**
                 * @function find the index of the given model or id.
                 * @param a and model or id of a model to find index of
                 */
        indexOf: function(a) {
            var model = getModel(this, a);

            return this.namespaceToIndex[model._cid];
        }
    });

    can.each(['pop', 'shift', 'unshift', 'splice', 'sort'], function(i, modifier) {
        can.Model.AssociativeList.prototype[modifier] = function() {
            throw "AssociativeList does not support modifying function: " + modifier;
        }
    });

});
