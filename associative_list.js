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

    var splice = [].splice,
        pop = [].pop;

    can.Model.List("can.Model.AssociativeList",
    {

    },
    {
        setup: function(ownerModel, containedClass, name, inverseName, hasAndBelongsToMany, polyClass, toAdd) {
            can.Model.List.prototype.setup.call(this, toAdd);

            this.ownerModel = ownerModel;
            this.inverseName = inverseName;
            this.hasAndBelongsToMany = hasAndBelongsToMany;
            this.name = name;
            this.$this = $([this]);

            this.containedClass = containedClass;
            this.namespaceToIndex = {};
        },

        push: function() {
            var args = getArgs(arguments),
                copied = false,
                oldLength = this.length,
                i;

            for (i = 0; i < args.length; i++) {
                var model = args[i] = can.getModel(this.containedClass, args[i]),
                    namespace = model._cid;

                if (this.namespaceToIndex[namespace] >= 0) {
                    if (!copied) {
                        args = $.merge([], args);
                        copied = true;
                    }
                    args.splice(i--, 1);
                } else {
                    this.namespaceToIndex[namespace] = oldLength++;
                    addRelationShip(this, model);
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
                    this[index] = this[this.length - 1];
                    this.namespaceToIndex[this[index]._cid] = index;
                    --this.length;
                }

                if (found) {
                    this._changed = true;
                    delete this.namespaceToIndex[found._cid];
                    removeRelationShip(this, found);
                    list.push(found);
                }
            }

            if (list.length) {
                this._triggerChange("0", "remove", undefined, list);
            }

            return new can.Model.List(list);
        },

        /**
        * @function remove all the models from the association list
        */
        removeAll: function() {
            var list = splice.call(this, 0, this.length);

            this.namespaceToIndex = {};
            for (var i = 0; i < list.length; i++) {
                removeRelationShip(this, list[i]);
            }

            var ret = new can.Model.List(list);
            if (ret.length) {
                this._triggerChange("0", "remove", undefined, ret);
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

            var self = this,
                toAdd = [],
                toRemoveModels = $.extend({}, this.namespaceToIndex);

            for (var i = 0; i < args.length; i++) {
                var model = can.getModel(this.containedClass, args[i]);
                if (toRemoveModels[model._cid] != null) {
                    delete toRemoveModels[model._cid];
                } else {
                    toAdd.push(model)
                }
            }

            var toRemove = $.map(toRemoveModels, function(index) { return self[index] });

            if (toRemove.length == this.length) {
                this.removeAll();
            } else {
                this.remove(toRemove);
            }

            return this.push(toAdd);
        },

        /**
         * @function find the index of the given model or id.
         * @param model model to find index of
         */
        indexOf: function(model) {
            return this.namespaceToIndex[model._cid];
        },

        /**
         * Only realy here to support the can.Model splice on destroy
         *
         * todo complete implementation
         */
        splice: function(index, howMany) {
            for (var i = 0; i < howMany; ++i) {
                this.remove(this[index+i]);
            }
        }
    });

    can.each(['pop', 'shift', 'unshift', 'sort'], function(i, modifier) {
        can.Model.AssociativeList.prototype[modifier] = function() {
            throw "AssociativeList does not support modifying function: " + modifier;
        }
    });

    function addRelationShip(self, newItem) {
        var name = self.name,
            inverseName = self.inverseName,
            ownerModel = self.ownerModel,
            hasAndBelongsToMany = self.hasAndBelongsToMany;

        if (!inverseName) return;

        if (ownerModel.isNew()) ownerModel.bind("created."+newItem._cid, function() { addRelationShip(self, newItem) });
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
    }

    function removeRelationShip(self, oldItem) {
        var inverseName = self.inverseName,
            ownerModel = self.ownerModel,
            hasAndBelongsToMany = self.hasAndBelongsToMany;

        if (!inverseName) return;

        ownerModel.unbind("created."+oldItem._cid);
        if (hasAndBelongsToMany) {
            if (oldItem[inverseName]) oldItem[inverseName].remove(ownerModel);
        } else {
            if (oldItem[inverseName] && oldItem[inverseName] == ownerModel) {
                oldItem.attr(inverseName, null);
            }
        }
    }
});
