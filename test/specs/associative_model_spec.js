steal(
    "can/assoc/associative_model.js",
    "can/assoc/associative_model.js"
).then(
    "can/util/deferred.js"
).then(function() {
    describe("Can.Models.AssociativeModel", function() {
        
        var oldInit = null;
        var saveIds = [];
        var autosave = false;

        function pushSaveId(id) {
            saveIds.push(id);
        }

        function updateCreate(attributes) {
            var attrs = {};
            for (var i in attributes) attrs[i] = attributes[i];
            if (typeof attrs.id == "undefined") attrs.id = saveIds.length ? saveIds.pop() : Math.floor(Math.random()*1000);
            return can.Deferred().resolve(attrs);
        }

        beforeEach(function() {
            autosave = true;
            can.Model.AssociativeModel("AutoSaveModel", {
                update: function(id, attrs) { return updateCreate(attrs); },
                create: updateCreate
            },
            {
                init: function() {
                    var result = this;
                    if (this._super) result = this._super.apply(this, arguments);
                    if (autosave) this.save();
                    this.bind("monkey", function() {});
                    return result;
                }
            });

            AutoSaveModel("AModel",
            {
                associations : {
                    hasMany : [
                        "BModel",
                        {type: "XModel", via: "b_models"}
                    ]
                }
            },
            {});

            AutoSaveModel("BModel",
            {
                associations : {
                    belongsTo : ["AModel", "XModel"]
                }
            },
            {});

            AutoSaveModel("XModel",
            {
                associations : {
                    hasAndBelongsToMany: "YModel"
                }
            },
            {});

            AutoSaveModel("YModel",
            {
                associations : {
                    hasAndBelongsToMany : "XModel"
                }
            },
            {});

            AutoSaveModel("CModel",
            {
                associations : {
                    hasMany : { type: "DModel", as: "DAble" }
                }
            },
            {});

            AutoSaveModel("DModel",
            {
                associations : {
                    belongsTo : { type: "DAble", polymorphic: true }
                }
            },
            {});

            AutoSaveModel("EModel",
            {
                associations : {
                    hasMany : { type: "DModel", as: "DAble" }
                }
            },
            {});

            AutoSaveModel("Person", {
                associations: {
                    hasAndBelongsToMany: { type: "Person", inverseName: "friends", name: "friends" },
                    belongsTo: [
                        { type: "Person", name: "boss", inverseName: "employees" },
                        { type: "Person", name: "crush", inverseName: null }
                    ],
                    hasMany: [
                        {type: "Person", name: "employees", inverseName: "boss"},
                        {type: "Person", name: "idles", inverseName: null}
                    ]
                }
            },
            {});
        });
        
        afterEach(function() {
            autosave = false;
        });

        it("triggers length listener when models are added or removed", function() {
            var a = new AModel({id: 1});
            a.attr("b_models", []);

            var spy = jasmine.createSpy();

            a.b_models.bind("length", spy);

            var b1 = new BModel({id: 1, a_model_id: 1});
            var b2 = new BModel({id: 2, a_model_id: 1});

            b1.attr("a_model_id", null);
            b2.attr("a_model_id", null);

            expect(spy.argsForCall.length).toEqual(4);
            expect(spy.argsForCall[0][1]).toEqual(1);
            expect(spy.argsForCall[1][1]).toEqual(2);
            expect(spy.argsForCall[2][1]).toEqual(1);
            expect(spy.argsForCall[3][1]).toEqual(0);
        });

        it("triggers length listener when models are replaced", function() {
            var a = new AModel({id: 1});
            var b1 = new BModel({id: 1});
            var b2 = new BModel({id: 2});
            a.attr("b_models", []);

            var spy = jasmine.createSpy();

            a.b_models.bind("length", spy);
            a.b_models.bind("length", function() {
                console.log("length");
            });

            a.attr("b_models", [1, 2]);
            a.attr("b_models", [1]);
            a.attr("b_models", []);

            expect(spy.argsForCall.length).toEqual(3);
            expect(spy.argsForCall[0][1]).toEqual(2);
            expect(spy.argsForCall[1][1]).toEqual(1);
            expect(spy.argsForCall[2][1]).toEqual(0);
        });

        
        it("children get modeled correctly", function()
        {
            var a = new AModel({b_models: [{val: "val1"}, {val: "val2"}]});
            expect(a.b_models).toBeTruthy();
            expect(a.b_models.length).toEqual(2);
            expect(a.b_models[0].constructor).toEqual(BModel);
            expect(a.b_models[1].constructor).toEqual(BModel);
            expect(a.b_models[0].a_model).toEqual(a);
            expect(a.b_models[1].a_model).toEqual(a);
        });

        it("children get modeled correctly when declared separately", function()
        {
            var b1 = new BModel({val: "val1"});
            var b2 = new BModel({val: "val2"});
            var a = new AModel({b_models: [b1, b2]});
            expect(a.b_models).toBeTruthy();
            expect(a.b_models.length).toEqual(2);
            expect(a.b_models[0].constructor).toEqual(BModel);
            expect(a.b_models[1].constructor).toEqual(BModel);
            expect(b1.a_model).toEqual(a);
            expect(b2.a_model).toEqual(a);
        });
        
        it("child id links back to parent", function()
        {
            var a = new AModel({id: 1, b_models: [{val: "val1", a_model_id: 1}, {val: "val2", a_model_id: 1}]});
            expect(a.b_models[0].a_model.id).toEqual(1);
            expect(a.b_models[1].a_model.id).toEqual(1);
        });
        
        it("add children to existing parent one at a time", function()
        {
            var a = new AModel({id: 1});
            var b1 = new BModel({id: 1, a_model_id: 1});
            var b2 = new BModel({id: 2, a_model_id: 1});
        
            expect(b1.a_model.id).toEqual(1);
            expect(b2.a_model.id).toEqual(1);
            expect(a.b_models.length).toEqual(2);
            expect(a.b_models[0].id).toEqual(1);
            expect(a.b_models[1].id).toEqual(2);
        });
        
        it("children with no id get added", function()
        {
            var a = new AModel({id: 1});
            var bs = BModel.models([{a_model_id: 1, val: "monkey"}, {a_model_id: 1, val: "banana"}]);
        
            expect(bs[0].a_model.id).toEqual(1);
            expect(bs[1].a_model.id).toEqual(1);
            expect(a.b_models.length).toEqual(2);
            expect(a.b_models[0].val).toEqual("monkey");
            expect(a.b_models[1].val).toEqual("banana");
        });

        it("links models when setting belongs to", function() {
            var a = new AModel();
            var b = new BModel();

            b.attr("a_model", a);

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
        });

        it ("links models when setting hasMany list with array", function() {
            var a = new AModel();
            var b = new BModel();

            a.attr("b_models", [b]);

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
        });

        it ("links models when setting hasMany list with list", function() {
            var a = new AModel();
            var b = new BModel();

            a.attr("b_models", BModel.models([b]));

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
        });

        it ("links models when pushing onto hasMany list", function() {
            var a = new AModel();
            var b = new BModel();

            a.attr("b_models", []);
            a.b_models.push(b);

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
        });

        it("removes links when removing belongs to", function() {
            var a = new AModel();
            var b = new BModel();
            b.attr("a_model", a);

            b.attr("a_model", null);

            expect(b.a_model).toBeNull();
            expect(a.b_models.length).toEqual(0);
        });

        it("removes links when removing from has many list", function() {
            var a = new AModel();
            var b = new BModel();
            b.attr("a_model", a);

            a.b_models.remove(b);

            expect(b.a_model).toBeNull();
            expect(a.b_models.length).toEqual(0);
        });

        it("swaps belongs to when pushing onto different has many", function () {
            var a1 = new AModel();
            var a2 = new AModel();
            var b = new BModel();

            b.attr("a_model", a1);
            b.attr("a_model", a2);


            expect(b.a_model).toEqual(a2);
            expect(a2.b_models.length).toEqual(1);
            expect(a2.b_models[0]).toEqual(b);
            expect(a1.b_models.length).toEqual(0);
        });

        it("swaps has many list when pushing onto different has many", function () {
            var a1 = new AModel();
            var a2 = new AModel();
            var b = new BModel();

            a1.attr("b_models", []);
            a2.attr("b_models", []);

            a1.b_models.push(b);
            a2.b_models.push(b);

            expect(b.a_model).toEqual(a2);
            expect(a2.b_models.length).toEqual(1);
            expect(a2.b_models[0]).toEqual(b);
            expect(a1.b_models.length).toEqual(0);
        });

        it ("creating list adds to other list in hasAndBelongsToMany", function() {
            var x = new XModel();
            var y = new YModel();

            x.attr("y_models", [y]);

            expect(x.y_models.length).toEqual(1);
            expect(x.y_models[0]).toEqual(y);
            expect(y.x_models.length).toEqual(1);
            expect(y.x_models[0]).toEqual(x);
        });

        it ("pushing onto list adds to other list in hasAndBelongsToMany", function() {
            var x = new XModel();
            var y = new YModel();

            y.attr("x_models", []);
            y.x_models.push(x);

            expect(x.y_models.length).toEqual(1);
            expect(x.y_models[0]).toEqual(y);
            expect(y.x_models.length).toEqual(1);
            expect(y.x_models[0]).toEqual(x);
        });

        it ("removing from list removes from other list in hasAndBelongsToMany", function() {
            var x = new XModel();
            var y = new YModel();

            x.attr("y_models", [y]);
            y.x_models.remove(x);

            expect(x.y_models.length).toEqual(0);
            expect(y.x_models.length).toEqual(0);
        });

        it ("setting id creates relationship and sets both fields", function() {
            var a = new AModel({id: 1});
            var b = new BModel({id: 1});

            b.attr("a_model_id", 1);

            expect(b.a_model_id).toEqual(1);
            expect(b.a_model).toEqual(a);
            expect(a.b_models[0]).toEqual(b);
        });

        it ("setting model sets both fields", function() {
            var a = new AModel({id: 1});
            var b = new BModel({id: 1});

            b.attr("a_model", a);

            expect(b.a_model_id).toEqual(1);
            expect(b.a_model).toEqual(a);
            expect(a.b_models[0]).toEqual(b);
        });

        it("sets id when creating from inline json models", function() {
            var a = AModel.model({id: 2, b_models: [{id: 1, a_model_id: 2}]});

            expect(a.b_models.length).toEqual(1);

            var b = a.b_models[0];
            expect(b.id).toEqual(1);
            expect(a.id).toEqual(2);
            expect(b.a_model).toEqual(a);
            expect(b.a_model.id).toEqual(2);
            expect(b.a_model_id).toEqual(2);
        });

        it("removes model from hasmany list when destroyed", function() {
            var a = new AModel();
            var b = new BModel();

            a.attr("b_models", [b]);

            b.destroyed();

            expect(a.b_models.length).toEqual(0);
        });

        it("removes model from belongs to when destroyed", function() {
            var a = new AModel();
            var b = new BModel();

            b.attr("a_model", a);

            a.destroyed();

            expect(b.a_model).toBeNull();
        });

        it("it unbinds destruction properly", function() {
            var a1 = new AModel();
            var a2 = new AModel();
            var b1 = new BModel();

            b1.attr("a_model", a1);
            b1.attr("a_model", a2);

            a1.destroyed();
            
            expect(b1.a_model).toEqual(a2);
        });

        it("filters attributes to send only belongs to id to server", function() {
            var a = new AModel({id: 8});
            var b = new BModel({id: 42});

            spyOn(BModel, "update").andCallThrough();

            b.attr("a_model", a);
            b.save();

            var data = BModel.update.argsForCall[0][1];

            expect(data["a_model_id"]).toEqual(8);
            expect(data["a_model"]).toBeUndefined();
        });

        it("allows construction of model that belongs to polymorphic parent", function()
        {
            var c = new CModel({val: "val1"});
            var d = new DModel({d_able: c});
            expect(d.constructor).toEqual(DModel);
            expect(d.d_able.constructor).toEqual(CModel);
            expect(d.d_able_type).toEqual("CModel");
            expect(d.d_able.d_models.length).toEqual(1);
            expect(d.d_able.d_models[0]).toEqual(d);
        });

        it("links back ids on construction for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1, d_models: [{val: "val1", id: 1, d_able_id: 1, d_able_type: "CModel"}, {val: "val2", id: 2, d_able_type: "CModel", d_able_id: 1}]});
            expect(c.d_models.length).toEqual(2);
            expect(c.d_models[0].id).toEqual(1);
            expect(c.d_models[1].id).toEqual(2);
            expect(c.d_models[0].d_able).toEqual(c);
            expect(c.d_models[1].d_able).toEqual(c);
        });

        it("links back ids one at a time for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1});
            var d1 = new DModel({val: "val1", id: 1, d_able_id: 1, d_able_type: "CModel"});
            var d2 = new DModel({val: "val2", id: 2, d_able_id: 1, d_able_type: "CModel"});
            expect(c.d_models.length).toEqual(2);
            expect(c.d_models[0]).toEqual(d1);
            expect(c.d_models[1]).toEqual(d2);
            expect(d1.d_able).toEqual(c);
            expect(d2.d_able).toEqual(c);
        });

        it("allows setting parent for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1});
            var d = new DModel({id: 2});
            d.attr("d_able", c);
            expect(d.d_able).toEqual(c);
            expect(d.d_able_type).toEqual("CModel");
            expect(d.d_able_id).toEqual(1);
            expect(c.d_models.length).toEqual(1);
            expect(c.d_models[0]).toEqual(d);
        });

        it("allows constructing parent for models that belongs to polymorphic parent", function()
        {
            var d = new DModel({id: 1, d_able_type: "CModel", d_able_id: 2, d_able: {id: 2, val: "val1"}});
            expect(d.d_able.id).toEqual(2);
            expect(d.d_able.d_models.length).toEqual(1);
            expect(d.d_able.d_models[0]).toEqual(d);
        });

        it("allows constructing parent in reverse parameter order for models that belongs to polymorphic parent", function()
        {
            var d = new DModel({id: 1, d_able: {id: 2, val: "val1"}, d_able_type: "CModel", d_able_id: 2});
            expect(d.d_able.id).toEqual(2);
            expect(d.d_able.d_models.length).toEqual(1);
            expect(d.d_able.d_models[0]).toEqual(d);
        });

        it("allows parent to set models for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1});
            var d = new DModel({id: 2});
            c.attr("d_models", [d]);
            expect(d.d_able).toEqual(c);
            expect(d.d_able_type).toEqual("CModel");
            expect(d.d_able_id).toEqual(1);
            expect(c.d_models.length).toEqual(1);
            expect(c.d_models[0]).toEqual(d);
        });

        it("allows parent to push models for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1});
            var d = new DModel({id: 2});
            c.attr("d_models", []);
            c.d_models.push(d);
            expect(d.d_able).toEqual(c);
            expect(d.d_able_type).toEqual("CModel");
            expect(d.d_able_id).toEqual(1);
            expect(c.d_models.length).toEqual(1);
            expect(c.d_models[0]).toEqual(d);
        });

        it("removes links when removing belongs to for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1});
            var d = new DModel({id: 2});
            c.attr("d_models", [d]);
            d.attr("d_able", null);
            expect(d.d_able).toBeNull();
            expect(c.d_models.length).toEqual(0);
        });

        it("removes links when removing from has many list for models that belongs to polymorphic parent", function()
        {
            var c = new CModel({id: 1});
            var d = new DModel({id: 2});
            d.attr("d_able", c);
            c.d_models.remove(d);
            expect(d.d_able).toBeNull();
            expect(c.d_models.length).toEqual(0);
        });

        it("swaps belongs to when pushing onto different has many for models that belongs to polymorphic parent", function () {
            var c = new CModel();
            var e = new EModel();
            var d = new DModel();

            d.attr("d_able", c);
            d.attr("d_able", e);

            expect(d.d_able).toEqual(e);
            expect(e.d_models.length).toEqual(1);
            expect(e.d_models[0]).toEqual(d);
            expect(c.d_models.length).toEqual(0);
        });

        it("swaps has many list when pushing onto different has many for models that belongs to polymorphic parent", function () {
            var c = new CModel();
            var e = new EModel();
            var d = new DModel();

            c.attr("d_models", []);
            e.attr("d_models", []);

            c.d_models.push(d);
            e.d_models.push(d);

            expect(d.d_able).toEqual(e);
            expect(e.d_models.length).toEqual(1);
            expect(e.d_models[0]).toEqual(d);
            expect(c.d_models.length).toEqual(0);
        });

        it("can set the poly model in order id then type", function() {
            var c = new CModel({id: 1});
            var d = new DModel();

            d.attr("d_able_id", 1);
            d.attr("d_able_type", c.constructor.fullName);

            expect(d.d_able).toEqual(c);
        });
        
        it("does not propegate belongs to relation ships until saved", function() {
            autosave = false;

            var a = new AModel();
            var b = new BModel();

            b.attr("a_model", a);

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(0);

            b.save();

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
        });

        it("does not propegate has many relation ships until saved", function() {
            autosave = false;

            var a = new AModel();
            var b = new BModel();

            a.attr("b_models", [b]);

            expect(b.a_model).toBeUndefined();
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
            
            a.save();

            expect(b.a_model).toEqual(a);
            expect(a.b_models.length).toEqual(1);
            expect(a.b_models[0]).toEqual(b);
        });

        it("connects has many relationships after point of creation", function() {
            var b1 = new BModel({id: 1, a_model_id: 1});
            var b2 = new BModel({id: 2, a_model_id: 1});
            pushSaveId(1);
            var a = new AModel({});

            expect(b1.a_model.id).toEqual(1);
            expect(b2.a_model.id).toEqual(1);
            expect(a.b_models.length).toEqual(2);
            expect(a.b_models[0].id).toEqual(1);
            expect(a.b_models[1].id).toEqual(2);
        });

        it("allows for inverse names to be set on has and belongs to many", function() {
            var p1 = new Person({id: 1});
            var p2 = new Person({id: 2});

            p1.attr("friends", [p2]);
            expect($.makeArray(p1.friends)).toEqual([p2]);
            expect($.makeArray(p2.friends)).toEqual([p1]);
        });

        it ("allows for inverse names to be set on has many", function() {
            var boss = new Person({id: 1});
            var emp1 = new Person({id: 2});
            var emp2 = new Person({id: 3});

            boss.attr("employees", [emp1]);
            emp2.attr("boss", boss);

            expect($.makeArray(boss.employees)).toEqual([emp1, emp2]);
            expect(emp1.boss).toEqual(boss);
            expect(emp2.boss).toEqual(boss);
        });

        it("does not set has many inverse relation ship when inverse name is null", function() {
            var idle = new Person({id: 1});
            var person = new Person({id: 2});

            person.attr("idles", [idle]);

            expect(idle.person).toBeUndefined();
        });

        it("does not set belongs to inverse relation ship when inverse name is null", function() {
            var hotPerson = new Person({id: 1});
            var person = new Person({id: 2});

            person.attr("crush", [hotPerson]);

            expect(hotPerson.person).toBeUndefined();
        });

        it("it only fires events of non common models when replace is called", function() {
            var b1 = new BModel();
            var b2 = new BModel();
            var b3 = new BModel();
            var b4 = new BModel();
            var b5 = new BModel();

            var addSpy = jasmine.createSpy();
            var removeSpy = jasmine.createSpy();

            var a = new AModel({b_models: [b1, b2, b3]});

            a.b_models.bind("add", addSpy);
            a.b_models.bind("remove", removeSpy);

            a.b_models.replace([b2, b4, b5]);

            expect($.makeArray(addSpy.argsForCall[0][1])).toEqual([b4, b5]);
            expect($.makeArray(removeSpy.argsForCall[0][1])).toEqual([b1, b3]);
            expect($.makeArray(a.b_models)).toEqual([b2, b4, b5]);

            a.b_models.replace([]);

            expect($.makeArray(removeSpy.argsForCall[1][1])).toEqual([b2, b4, b5]);
            expect(addSpy.callCount).toEqual(1);
            expect($.makeArray(a.b_models)).toEqual([]);

            a.b_models.replace([b1, b2, b3]);

            expect($.makeArray(addSpy.argsForCall[1][1])).toEqual([b1, b2, b3]);
            expect(removeSpy.callCount).toEqual(2);
            expect($.makeArray(a.b_models)).toEqual([b1, b2, b3]);

            a.b_models.replace([b4, b5]);

            expect($.makeArray(addSpy.argsForCall[2][1])).toEqual([b4, b5]);
            expect($.makeArray(removeSpy.argsForCall[2][1])).toEqual([b1, b2, b3]);
        });

        it("associates via models when created", function() {
            var x = new XModel();
            var b = new BModel({x_model: x});
            var a = new AModel({b_models: [b]});

            expect($.makeArray(a.x_models)).toEqual([x]);
        });

        it("associates via models does not contain duplicates", function() {
            var x1 = new XModel();
            var x2 = new XModel();
            var b1 = new BModel({x_model: x1});
            var b2 = new BModel({x_model: x1});
            var b3 = new BModel({x_model: x2});

            var a = new AModel({b_models: [b1, b2, b3]});
            expect($.makeArray(a.x_models)).toEqual([x1, x2]);

            a.b_models.remove(b1);
            expect($.makeArray(a.x_models)).toEqual([x1, x2]);

            a.b_models.remove(b2);
            expect($.makeArray(a.x_models)).toEqual([x2]);

            a.b_models.remove(b3);
            expect($.makeArray(a.x_models)).toEqual([]);

            a.b_models.push(b1);
            expect($.makeArray(a.x_models)).toEqual([x1]);
            a.b_models.push(b2);
            expect($.makeArray(a.x_models)).toEqual([x1]);
        });

        it("updates associates when the source changes", function() {
            var x1 = new XModel();
            var x2 = new XModel();
            var b = new BModel({x_model: x1});
            var a = new AModel({b_models: [b]});

            expect($.makeArray(a.x_models)).toEqual([x1]);

            b.attr("x_model", x2);
            expect($.makeArray(a.x_models)).toEqual([x2]);

            b.attr("x_model", null);
            expect($.makeArray(a.x_models)).toEqual([]);

            b.attr("x_model", x1);
            expect($.makeArray(a.x_models)).toEqual([x1]);
        });

    });
});