import { compile } from "../htmlbars-compiler/compiler";
import { forEach } from "../htmlbars-compiler/utils";
import { tokenize } from "../simple-html-tokenizer";
import { hydrationHooks } from "../htmlbars-runtime/hooks";
import { DOMHelper } from "../morph";
import { normalizeInnerHTML } from "../htmlbars-test-helpers";

var xhtmlNamespace = "http://www.w3.org/1999/xhtml",
    svgNamespace   = "http://www.w3.org/2000/svg";

var hooks, helpers, partials, env;

function registerHelper(name, callback) {
  helpers[name] = callback;
}

function registerPartial(name, html) {
  partials[name] = compile(html);
}

function lookupHelper(helperName) {
  if (helperName === 'attribute') {
    return this.attribute;
  } else if (helperName === 'concat') {
    return this.concat;
  } else if (helperName === 'partial') {
    return this.partial;
  } else {
    return helpers[helperName];
  }
}

function compilesTo(html, expected, context) {
  var template = compile(html);
  var fragment = template(context, env, document.body);
  equalTokens(fragment, expected === undefined ? html : expected);
  return fragment;
}

function equalTokens(fragment, html) {
  var div = document.createElement("div");
  div.appendChild(fragment.cloneNode(true));
  var fragTokens = tokenize(div.innerHTML);

  div.removeChild(div.childNodes[0]);
  div.innerHTML = html;
  var htmlTokens = tokenize(div.innerHTML);

  function normalizeTokens(token) {
    if (token.type === 'StartTag') {
      token.attributes = token.attributes.sort(function(a,b){
        if (a.name > b.name) {
          return 1;
        }
        if (a.name < b.name) {
          return -1;
        }
        return 0;
      });
    }
  }

  forEach(fragTokens, normalizeTokens);
  forEach(htmlTokens, normalizeTokens);

  deepEqual(fragTokens, htmlTokens);
}

QUnit.module("HTML-based compiler (output)", {
  setup: function() {
    helpers = {};
    partials = {};
    hooks = hydrationHooks({lookupHelper : lookupHelper});

    env = {
      hooks: hooks,
      helpers: helpers,
      dom: new DOMHelper(),
      partials: partials
    };
  }
});

test("Simple content produces a document fragment", function() {
  var template = compile("content");
  var fragment = template({}, env);

  equalTokens(fragment, "content");
});

test("Simple elements are created", function() {
  var template = compile("<h1>hello!</h1><div>content</div>");
  var fragment = template({}, env);

  equalTokens(fragment, "<h1>hello!</h1><div>content</div>");
});

test("Simple elements can have attributes", function() {
  var template = compile("<div class='foo' id='bar'>content</div>");
  var fragment = template({}, env);

  equalTokens(fragment, '<div class="foo" id="bar">content</div>');
});

test("Simple elements can have an empty attribute", function() {
  var template = compile("<div class=''>content</div>");
  var fragment = template({}, env);

  equalTokens(fragment, '<div class="">content</div>');
});

test("Null quoted attribute value calls toString on the value", function() {
  var template = compile('<input disabled="{{isDisabled}}">');
  var fragment = template({isDisabled: null}, env);

  equalTokens(fragment, '<input disabled="null">');
});

test("Null unquoted attribute value removes that attribute", function() {

  var template = compile('<input disabled={{isDisabled}}>');
  var fragment = template({isDisabled: null}, env);

  equalTokens(fragment, '<input>');
});

test("unquoted attribute string is just that", function() {

  var template = compile('<input value=funstuff>');
  var fragment = template({}, env);

  equalTokens(fragment, '<input value="funstuff">');
});

test("unquoted attribute expression is string", function() {

  var template = compile('<input value={{funstuff}}>');
  var fragment = template({funstuff: "oh my"}, env);

  equalTokens(fragment, '<input value="oh my">');
});

test("Simple elements can have arbitrary attributes", function() {
  var template = compile("<div data-some-data='foo'>content</div>");
  var fragment = template({}, env);
  equalTokens(fragment, '<div data-some-data="foo">content</div>');
});

test("checked attribute and checked property are present after clone and hydrate", function() {
  var template = compile("<input checked=\"checked\">");
  var fragment = template({}, env);
  ok(fragment.checked, 'input is checked');
  equalTokens(fragment, "<input checked='checked'>");
});

test("SVG element can have capitalized attributes", function() {
  var template = compile("<svg viewBox=\"0 0 0 0\"></svg>");
  var fragment = template({}, env);
  equalTokens(fragment, '<svg viewBox=\"0 0 0 0\"></svg>');
});

test("checked attribute and checked property are present after clone and hydrate", function() {
  var template = compile("<input checked=\"checked\">");
  var fragment = template({}, env);
  ok(fragment.checked, 'input is checked');
  equalTokens(fragment, "<input checked='checked'>");
});

function shouldBeVoid(tagName) {
  var html = "<" + tagName + " data-foo='bar'><p>hello</p>";
  var template = compile(html);
  var fragment = template({}, env);


  var div = document.createElement("div");
  div.appendChild(fragment.cloneNode(true));

  var tag = '<' + tagName + ' data-foo="bar">';
  var closing = '</' + tagName + '>';
  var extra = "<p>hello</p>";
  html = normalizeInnerHTML(div.innerHTML);

  QUnit.push((html === tag + extra) || (html === tag + closing + extra), html, tag + closing + extra, tagName + "should be a void element");
}

test("Void elements are self-closing", function() {
  var voidElements = "area base br col command embed hr img input keygen link meta param source track wbr";

  forEach(voidElements.split(" "), function(tagName) {
    shouldBeVoid(tagName);
  });
});

test("The compiler can handle nesting", function() {
  var html = '<div class="foo"><p><span id="bar" data-foo="bar">hi!</span></p></div> More content';
  var template = compile(html);
  var fragment = template({}, env);

  equalTokens(fragment, html);
});

test("The compiler can handle quotes", function() {
  compilesTo('<div>"This is a title," we\'re on a boat</div>');
});

test("The compiler can handle newlines", function() {
  compilesTo("<div>common\n\nbro</div>");
});

test("The compiler can handle comments", function() {
  compilesTo("<div>{{! Better not break! }}content</div>", '<div>content</div>', {});
});

test("The compiler can handle HTML comments", function() {
  compilesTo('<div><!-- Just passing through --></div>');
});

test("The compiler can handle HTML comments with mustaches in them", function() {
  compilesTo('<div><!-- {{foo}} --></div>', '<div><!-- {{foo}} --></div>', { foo: 'bar' });
});

test("The compiler can handle HTML comments with complex mustaches in them", function() {
  compilesTo('<div><!-- {{foo bar baz}} --></div>', '<div><!-- {{foo bar baz}} --></div>', { foo: 'bar' });
});

test("The compiler can handle HTML comments with multi-line mustaches in them", function() {
  compilesTo('<div><!-- {{#each foo as |bar|}}\n{{bar}}\n\n{{/each}} --></div>');
});

test('The compiler can handle comments with no parent element', function() {
  compilesTo('<!-- {{foo}} -->');
});

// TODO: Revisit partial syntax.
// test("The compiler can handle partials in handlebars partial syntax", function() {
//   registerPartial('partial_name', "<b>Partial Works!</b>");
//   compilesTo('<div>{{>partial_name}} Plaintext content</div>', '<div><b>Partial Works!</b> Plaintext content</div>', {});
// });

test("The compiler can handle partials in helper partial syntax", function() {
  registerPartial('partial_name', "<b>Partial Works!</b>");
  compilesTo('<div>{{partial "partial_name"}} Plaintext content</div>', '<div><b>Partial Works!</b> Plaintext content</div>', {});
});

test("The compiler can handle simple handlebars", function() {
  compilesTo('<div>{{title}}</div>', '<div>hello</div>', { title: 'hello' });
});

test("The compiler can handle escaping HTML", function() {
  compilesTo('<div>{{title}}</div>', '<div>&lt;strong&gt;hello&lt;/strong&gt;</div>', { title: '<strong>hello</strong>' });
});

test("The compiler can handle unescaped HTML", function() {
  compilesTo('<div>{{{title}}}</div>', '<div><strong>hello</strong></div>', { title: '<strong>hello</strong>' });
});

test("The compiler can handle top-level unescaped HTML", function() {
  compilesTo('{{{html}}}', '<strong>hello</strong>', { html: '<strong>hello</strong>' });
});

test("The compiler can handle top-level unescaped tr", function() {
  var template = compile('{{{html}}}');
  var fragment = template({
                   html: '<tr><td>Yo</td></tr>'
                 }, {
                   hooks: hooks,
                   dom: new DOMHelper()
                 }, document.createElement('table'));

  equal(
    fragment.childNodes[1].tagName, 'TR',
    "root tr is present" );
});

test("The compiler can handle top-level unescaped td inside tr contextualElement", function() {
  var template = compile('{{{html}}}');
  var fragment = template({
                   html: '<td>Yo</td>'
                 }, {
                   hooks: hooks,
                   dom: new DOMHelper()
                 }, document.createElement('tr'));

  equal(
    fragment.childNodes[1].tagName, 'TD',
    "root td is returned" );
});

test("The compiler can handle unescaped tr in top of content", function() {
  var helper = function(params, hash, options, env) {
    return options.render(this, env, options.morph.contextualElement);
  };
  hooks.lookupHelper = function(name){
    if (name === 'test') {
      return helper;
    }
  };
  var template = compile('{{#test}}{{{html}}}{{/test}}');
  var fragment = template({
                   html: '<tr><td>Yo</td></tr>'
                 }, {
                   hooks: hooks,
                   dom: new DOMHelper()
                 }, document.createElement('table'));

  equal(
    fragment.childNodes[2].tagName, 'TR',
    "root tr is present" );
});

test("The compiler can handle unescaped tr inside fragment table", function() {
  var helper = function(params, hash, options, env) {
    return options.render(this, env, options.morph.contextualElement);
  };
  hooks.lookupHelper = function(name){
    if (name === 'test') {
      return helper;
    }
  };
  var template = compile('<table>{{#test}}{{{html}}}{{/test}}</table>'),
      fragment = template({
                   html: '<tr><td>Yo</td></tr>'
                 }, {
                   hooks: hooks,
                   dom: new DOMHelper()
                 }, document.createElement('div'));

  equal(
    fragment.childNodes[1].tagName, 'TR',
    "root tr is present" );
});

test("The compiler can handle simple helpers", function() {
  registerHelper('testing', function(params) {
    return this[params[0]];
  });

  compilesTo('<div>{{testing title}}</div>', '<div>hello</div>', { title: 'hello' });
});

test("The compiler can handle sexpr helpers", function() {
  registerHelper('testing', function(params) {
    return params[0] + "!";
  });

  compilesTo('<div>{{testing (testing "hello")}}</div>', '<div>hello!!</div>', {});
});

test("The compiler can handle multiple invocations of sexprs", function() {
  function evalParam(context, param, type) {
    if (type === 'id') {
      return context[param];
    } else {
      return param;
    }
  }

  registerHelper('testing', function(params, hash, options) {
    return evalParam(this, params[0], options.paramTypes[0]) +
           evalParam(this, params[1], options.paramTypes[1]);
  });

  compilesTo('<div>{{testing (testing "hello" foo) (testing (testing bar "lol") baz)}}</div>', '<div>helloFOOBARlolBAZ</div>', { foo: "FOO", bar: "BAR", baz: "BAZ" });
});

test("The compiler tells helpers what kind of expression the path is", function() {
  registerHelper('testing', function(params, hash, options) {
    return options.paramTypes[0] + '-' + params[0];
  });

  compilesTo('<div>{{testing "title"}}</div>', '<div>string-title</div>');
  compilesTo('<div>{{testing 123}}</div>', '<div>number-123</div>');
  compilesTo('<div>{{testing true}}</div>', '<div>boolean-true</div>');
  compilesTo('<div>{{testing false}}</div>', '<div>boolean-false</div>');
});

test("The compiler passes along the hash arguments", function() {
  registerHelper('testing', function(params, hash) {
    return hash.first + '-' + hash.second;
  });

  compilesTo('<div>{{testing first="one" second="two"}}</div>', '<div>one-two</div>');
});

test("The compiler passes along the paramTypes of the hash arguments", function() {
  registerHelper('testing', function(params, hash, options) {
    return options.hashTypes.first + '-' + hash.first;
  });

  compilesTo('<div>{{testing first="one"}}</div>', '<div>string-one</div>');
  compilesTo('<div>{{testing first=one}}</div>', '<div>id-one</div>');
  compilesTo('<div>{{testing first=1}}</div>', '<div>number-1</div>');
  compilesTo('<div>{{testing first=true}}</div>', '<div>boolean-true</div>');
  compilesTo('<div>{{testing first=false}}</div>', '<div>boolean-false</div>');
});

test("It is possible to override the resolution mechanism", function() {
  hooks.simple = function(context, name) {
    if (name === 'zomg') {
      return context.zomg;
    } else {
      return name.replace('.', '-');
    }
  };

  compilesTo('<div>{{foo}}</div>', '<div>foo</div>');
  compilesTo('<div>{{foo.bar}}</div>', '<div>foo-bar</div>');
  compilesTo('<div>{{zomg}}</div>', '<div>hello</div>', { zomg: 'hello' });
});

test("Simple data binding using text nodes", function() {
  var callback;

  hooks.content = function(morph, path, context) {
    callback = function() {
      morph.update(context[path]);
    };
    callback();
  };

  var object = { title: 'hello' };
  var fragment = compilesTo('<div>{{title}} world</div>', '<div>hello world</div>', object);

  object.title = 'goodbye';
  callback();

  equalTokens(fragment, '<div>goodbye world</div>');

  object.title = 'brown cow';
  callback();

  equalTokens(fragment, '<div>brown cow world</div>');
});

test("Simple data binding on fragments", function() {
  var callback;

  hooks.content = function(morph, path, context) {
    morph.escaped = false;
    callback = function() {
      morph.update(context[path]);
    };
    callback();
  };

  var object = { title: '<p>hello</p> to the' };
  var fragment = compilesTo('<div>{{title}} world</div>', '<div><p>hello</p> to the world</div>', object);

  object.title = '<p>goodbye</p> to the';
  callback();

  equalTokens(fragment, '<div><p>goodbye</p> to the world</div>');

  object.title = '<p>brown cow</p> to the';
  callback();

  equalTokens(fragment, '<div><p>brown cow</p> to the world</div>');
});

test("morph receives escaping information", function() {
  expect(3);

  hooks.content = function(morph, path) {
    if (path === 'escaped') {
      equal(morph.escaped, true);
    } else if (path === 'unescaped') {
      equal(morph.escaped, false);
    }

    morph.update(path);
  };

  // so we NEED a reference to div. because it's passed in twice.
  // not divs childNodes.
  // the parent we need to save is fragment.childNodes
  compilesTo('<div>{{escaped}}-{{{unescaped}}}</div>', '<div>escaped-unescaped</div>');
});

test("Helpers receive escaping information", function() {
  expect(8);

  function emptyHash(hash) {
    for(var key in hash) { // jshint ignore:line
      return false;
    }
    return true;
  }

  registerHelper('testing-unescaped', function(params, hash, options) {
    if (params.length === 0 && emptyHash(hash)) {
      //ambiguous mustache
      equal(options.morph.escaped, false);
    } else {
      equal(options.morph.escaped, false);
    }

    return params[0];
  });

  registerHelper('testing-escaped', function(params, hash, options, env) {
    if (options.render) {
      equal(options.morph.escaped, true);
      return options.render({}, env, options.morph.contextualElement);
    } else if (params.length === 0 && emptyHash(hash)) {
      //ambiguous mustache
      equal(options.morph.escaped, true);
    } else {
      equal(options.morph.escaped, true);
    }

    return params[0];
  });

  compilesTo('<div>{{{testing-unescaped}}}-{{{testing-unescaped a}}}</div>', '<div>-a</div>');
  compilesTo('<div>{{testing-escaped}}-{{testing-escaped b}}</div>', '<div>-b</div>');
  compilesTo('<div>{{#testing-escaped}}c{{/testing-escaped}}</div>', '<div>c</div>');
});

test("Attributes can use computed values", function() {
  compilesTo('<a href="{{url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html' });
});

test("Mountain range of nesting", function() {
  var context = { foo: "FOO", bar: "BAR", baz: "BAZ", boo: "BOO", brew: "BREW", bat: "BAT", flute: "FLUTE", argh: "ARGH" };
  compilesTo('{{foo}}<span></span>', 'FOO<span></span>', context);
  compilesTo('<span></span>{{foo}}', '<span></span>FOO', context);
  compilesTo('<span>{{foo}}</span>{{foo}}', '<span>FOO</span>FOO', context);
  compilesTo('{{foo}}<span>{{foo}}</span>{{foo}}', 'FOO<span>FOO</span>FOO', context);
  compilesTo('{{foo}}<span></span>{{foo}}', 'FOO<span></span>FOO', context);
  compilesTo('{{foo}}<span></span>{{bar}}<span><span><span>{{baz}}</span></span></span>',
             'FOO<span></span>BAR<span><span><span>BAZ</span></span></span>', context);
  compilesTo('{{foo}}<span></span>{{bar}}<span>{{argh}}<span><span>{{baz}}</span></span></span>',
             'FOO<span></span>BAR<span>ARGH<span><span>BAZ</span></span></span>', context);
  compilesTo('{{foo}}<span>{{bar}}<a>{{baz}}<em>{{boo}}{{brew}}</em>{{bat}}</a></span><span><span>{{flute}}</span></span>{{argh}}',
             'FOO<span>BAR<a>BAZ<em>BOOBREW</em>BAT</a></span><span><span>FLUTE</span></span>ARGH', context);
});

// test("Attributes can use computed paths", function() {
//   compilesTo('<a href="{{post.url}}">linky</a>', '<a href="linky.html">linky</a>', { post: { url: 'linky.html' }});
// });

/*

test("It is possible to use RESOLVE_IN_ATTR for data binding", function() {
  var callback;

  registerHelper('RESOLVE_IN_ATTR', function(parts, options) {
    return boundValue(function(c) {
      callback = c;
      return this[parts[0]];
    }, this);
  });

  var object = { url: 'linky.html' };
  var fragment = compilesTo('<a href="{{url}}">linky</a>', '<a href="linky.html">linky</a>', object);

  object.url = 'clippy.html';
  callback();

  equalTokens(fragment, '<a href="clippy.html">linky</a>');

  object.url = 'zippy.html';
  callback();

  equalTokens(fragment, '<a href="zippy.html">linky</a>');
});
*/

test("Attributes can be populated with helpers that generate a string", function() {
  registerHelper('testing', function(params) {
    return this[params[0]];
  });

  compilesTo('<a href="{{testing url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html'});
});
/*
test("A helper can return a stream for the attribute", function() {
  registerHelper('testing', function(path, options) {
    return streamValue(this[path]);
  });

  compilesTo('<a href="{{testing url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html'});
});
*/
test("Attribute helpers take a hash", function() {
  registerHelper('testing', function(params, hash) {
    return this[hash.path];
  });

  compilesTo('<a href="{{testing path=url}}">linky</a>', '<a href="linky.html">linky</a>', { url: 'linky.html' });
});
/*
test("Attribute helpers can use the hash for data binding", function() {
  var callback;

  registerHelper('testing', function(path, hash, options) {
    return boundValue(function(c) {
      callback = c;
      return this[path] ? hash.truthy : hash.falsy;
    }, this);
  });

  var object = { on: true };
  var fragment = compilesTo('<div class="{{testing on truthy="yeah" falsy="nope"}}">hi</div>', '<div class="yeah">hi</div>', object);

  object.on = false;
  callback();
  equalTokens(fragment, '<div class="nope">hi</div>');
});
*/
test("Attributes containing multiple helpers are treated like a block", function() {
  registerHelper('testing', function(params, hash, options) {
    if (options.paramTypes[0] === 'id') {
      return this[params[0]];
    } else {
      return params[0];
    }
  });

  compilesTo('<a href="http://{{foo}}/{{testing bar}}/{{testing "baz"}}">linky</a>', '<a href="http://foo.com/bar/baz">linky</a>', { foo: 'foo.com', bar: 'bar' });
});

test("Attributes containing a helper are treated like a block", function() {
  expect(2);

  registerHelper('testing', function(params) {
    deepEqual(params, [123]);
    return "example.com";
  });

  compilesTo('<a href="http://{{testing 123}}/index.html">linky</a>', '<a href="http://example.com/index.html">linky</a>', { person: { url: 'example.com' } });
});
/*
test("It is possible to trigger a re-render of an attribute from a child resolution", function() {
  var callback;

  registerHelper('RESOLVE_IN_ATTR', function(path, options) {
    return boundValue(function(c) {
      callback = c;
      return this[path];
    }, this);
  });

  var context = { url: "example.com" };
  var fragment = compilesTo('<a href="http://{{url}}/index.html">linky</a>', '<a href="http://example.com/index.html">linky</a>', context);

  context.url = "www.example.com";
  callback();

  equalTokens(fragment, '<a href="http://www.example.com/index.html">linky</a>');
});

test("A child resolution can pass contextual information to the parent", function() {
  var callback;

  registerHelper('RESOLVE_IN_ATTR', function(path, options) {
    return boundValue(function(c) {
      callback = c;
      return this[path];
    }, this);
  });

  var context = { url: "example.com" };
  var fragment = compilesTo('<a href="http://{{url}}/index.html">linky</a>', '<a href="http://example.com/index.html">linky</a>', context);

  context.url = "www.example.com";
  callback();

  equalTokens(fragment, '<a href="http://www.example.com/index.html">linky</a>');
});

test("Attribute runs can contain helpers", function() {
  var callbacks = [];

  registerHelper('RESOLVE_IN_ATTR', function(path, options) {
    return boundValue(function(c) {
      callbacks.push(c);
      return this[path];
    }, this);
  });

  registerHelper('testing', function(path, options) {
    return boundValue(function(c) {
      callbacks.push(c);

      if (options.paramTypes[0] === 'id') {
        return this[path] + '.html';
      } else {
        return path;
      }
    }, this);
  });

  var context = { url: "example.com", path: 'index' };
  var fragment = compilesTo('<a href="http://{{url}}/{{testing path}}/{{testing "linky"}}">linky</a>', '<a href="http://example.com/index.html/linky">linky</a>', context);

  context.url = "www.example.com";
  context.path = "yep";
  forEach(callbacks, function(callback) { callback(); });

  equalTokens(fragment, '<a href="http://www.example.com/yep.html/linky">linky</a>');

  context.url = "nope.example.com";
  context.path = "nope";
  forEach(callbacks, function(callback) { callback(); });

  equalTokens(fragment, '<a href="http://nope.example.com/nope.html/linky">linky</a>');
});
*/
test("A simple block helper can return the default document fragment", function() {

  hooks.content = function(morph, path, context, params, hash, options, env) {
    morph.update(options.render(context, env));
  };

  compilesTo('{{#testing}}<div id="test">123</div>{{/testing}}', '<div id="test">123</div>');
});

test("A simple block helper can return text", function() {
  hooks.content = function(morph, path, context, params, hash, options, env) {
    morph.update(options.render(context, env));
  };

  compilesTo('{{#testing}}test{{else}}not shown{{/testing}}', 'test');
});

test("A block helper can have an else block", function() {
  hooks.content = function(morph, path, context, params, hash, options, env) {
    morph.update(options.inverse(context, env));
  };

  compilesTo('{{#testing}}Nope{{else}}<div id="test">123</div>{{/testing}}', '<div id="test">123</div>');
});

test("A block helper can pass a context to be used in the child", function() {
  var originalContent = hooks.content;
  hooks.content = function(morph, path, context, params, hash, options, env) {
    if (path === 'testing') {
      morph.update(options.render({ title: 'Rails is omakase' }, env));
    } else {
      originalContent.apply(this, arguments);
    }
  };

  compilesTo('{{#testing}}<div id="test">{{title}}</div>{{/testing}}', '<div id="test">Rails is omakase</div>');
});

test("Block helpers receive hash arguments", function() {
  hooks.content = function(morph, path, context, params, hash, options, env) {
    if (hash.truth) {
      options.hooks = this;
      morph.update(options.render(context, env));
    }
  };

  compilesTo('{{#testing truth=true}}<p>Yep!</p>{{/testing}}{{#testing truth=false}}<p>Nope!</p>{{/testing}}', '<p>Yep!</p>');
});
/*

test("Data-bound block helpers", function() {
  var callback;

  registerHelper('testing', function(path, options) {
    var context = this, firstElement, lastElement;

    var frag = buildFrag();

    function buildFrag() {
      var frag;

      var value = context[path];

      if (value) {
        frag = options.render(context);
      } else {
        frag = document.createDocumentFragment();
      }

      if (!frag.firstChild) {
        firstElement = lastElement = document.createTextNode('');
        frag.appendChild(firstElement);
      } else {
        firstElement = frag.firstChild;
        lastElement = frag.lastChild;
      }

      return frag;
    }

    callback = function() {
      var range = document.createRange();
      range.setStartBefore(firstElement);
      range.setEndAfter(lastElement);

      var frag = buildFrag();

      range.deleteContents();
      range.insertNode(frag);
    };

    return frag;
  });

  var object = { shouldRender: false };
  var template = '<p>hi</p> content {{#testing shouldRender}}<p>Appears!</p>{{/testing}} more <em>content</em> here';
  var fragment = compilesTo(template, '<p>hi</p> content  more <em>content</em> here', object);

  object.shouldRender = true;
  callback();

  equalTokens(fragment, '<p>hi</p> content <p>Appears!</p> more <em>content</em> here');

  object.shouldRender = false;
  callback();

  equalTokens(fragment, '<p>hi</p> content  more <em>content</em> here');
});
*/

test("Node helpers can modify the node", function() {
  registerHelper('testing', function(params, hash, options) {
    options.element.setAttribute('zomg', 'zomg');
  });

  compilesTo('<div {{testing}}>Node helpers</div>', '<div zomg="zomg">Node helpers</div>');
});

test("Node helpers can modify the node after one node appended by top-level helper", function() {
  registerHelper('top-helper', function() {
    return document.createElement('span');
  });
  registerHelper('attr-helper', function(params, hash, options) {
    options.element.setAttribute('zomg', 'zomg');
  });

  compilesTo('<div {{attr-helper}}>Node helpers</div>{{top-helper}}', '<div zomg="zomg">Node helpers</div><span></span>');
});

test("Node helpers can modify the node after one node prepended by top-level helper", function() {
  registerHelper('top-helper', function() {
    return document.createElement('span');
  });
  registerHelper('attr-helper', function(params, hash, options) {
    options.element.setAttribute('zomg', 'zomg');
  });

  compilesTo('{{top-helper}}<div {{attr-helper}}>Node helpers</div>', '<span></span><div zomg="zomg">Node helpers</div>');
});

test("Node helpers can modify the node after many nodes returned from top-level helper", function() {
  registerHelper('top-helper', function() {
    var frag = document.createDocumentFragment();
    frag.appendChild(document.createElement('span'));
    frag.appendChild(document.createElement('span'));
    return frag;
  });
  registerHelper('attr-helper', function(params, hash, options) {
    options.element.setAttribute('zomg', 'zomg');
  });

  compilesTo(
    '{{top-helper}}<div {{attr-helper}}>Node helpers</div>',
    '<span></span><span></span><div zomg="zomg">Node helpers</div>' );
});

test("Node helpers can be used for attribute bindings", function() {
  var callback;

  registerHelper('testing', function(params, hash, options) {
    var path = hash.href,
        element = options.element;
    var context = this;

    callback = function() {
      var value = context[path];
      element.setAttribute('href', value);
    };

    callback();
  });

  var object = { url: 'linky.html' };
  var fragment = compilesTo('<a {{testing href="url"}}>linky</a>', '<a href="linky.html">linky</a>', object);

  object.url = 'zippy.html';
  callback();

  equalTokens(fragment, '<a href="zippy.html">linky</a>');
});


test('Components - Called as helpers', function () {
  registerHelper('x-append', function(params, hash, options, env) {
    var fragment = options.render(this, env, options.morph.contextualElement);
    fragment.appendChild(document.createTextNode(hash.text));
    return fragment;
  });
  var object = { bar: 'e', baz: 'c' };
  compilesTo('a<x-append text="d{{bar}}">b{{baz}}</x-append>f','abcdef', object);
});

test('Components - Unknown helpers fall back to elements', function () {
  var object = { size: 'med', foo: 'b' };
  compilesTo('<x-bar class="btn-{{size}}">a{{foo}}c</x-bar>','<x-bar class="btn-med">abc</x-bar>', object);
});

test('Components - Text-only attributes work', function () {
  var object = { foo: 'qux' };
  compilesTo('<x-bar id="test">{{foo}}</x-bar>','<x-bar id="test">qux</x-bar>', object);
});

test('Components - Empty components work', function () {
  compilesTo('<x-bar></x-bar>','<x-bar></x-bar>', {});
});

test('Components - Text-only dashed attributes work', function () {
  var object = { foo: 'qux' };
  compilesTo('<x-bar aria-label="foo" id="test">{{foo}}</x-bar>','<x-bar aria-label="foo" id="test">qux</x-bar>', object);
});

test('Repaired text nodes are ensured in the right place', function () {
  var object = { a: "A", b: "B", c: "C", d: "D" };
  compilesTo('{{a}} {{b}}', 'A B', object);
  compilesTo('<div>{{a}}{{b}}{{c}}wat{{d}}</div>', '<div>ABCwatD</div>', object);
  compilesTo('{{a}}{{b}}<img><img><img><img>', 'AB<img><img><img><img>', object);
});

test("Simple elements can have dashed attributes", function() {
  var template = compile("<div aria-label='foo'>content</div>");
  var fragment = template({}, env);

  equalTokens(fragment, '<div aria-label="foo">content</div>');
});

test("Block params", function() {
  registerHelper('a', function(params, hash, options, env) {
    var context = Object.create(this);
    var span = document.createElement('span');
    span.appendChild(options.render(context, env, document.body, ['W', 'X1']));
    return 'A(' + span.innerHTML + ')';
  });
  registerHelper('b', function(params, hash, options, env) {
    var context = Object.create(this);
    var span = document.createElement('span');
    span.appendChild(options.render(context, env, document.body, ['X2', 'Y']));
    return 'B(' + span.innerHTML + ')';
  });
  registerHelper('c', function(params, hash, options, env) {
    var context = Object.create(this);
    var span = document.createElement('span');
    span.appendChild(options.render(context, env, document.body, ['Z']));
    return 'C(' + span.innerHTML + ')';
    // return "C(" + options.render() + ")";
  });
  var t = '{{#a as |w x|}}{{w}},{{x}} {{#b as |x y|}}{{x}},{{y}}{{/b}} {{w}},{{x}} {{#c as |z|}}{{x}},{{z}}{{/c}}{{/a}}';

  compilesTo(t, 'A(W,X1 B(X2,Y) W,X1 C(X1,Z))', {});
});

test("Block params - Helper should know how many block params it was called with", function() {
  expect(4);

  registerHelper('without-block-params', function(params, hash, options) {
    ok(!('blockParams' in options), 'Helpers should not be passed a blockParams option if not called with block params.');
  });
  registerHelper('with-block-params', function(params, hash, options) {
    equal(options.blockParams, this.count, 'Helpers should recieve the correct number of block params in options.blockParams.');
  });

  compile('{{#without-block-params}}{{/without-block-params}}')({}, env, document.body);
  compile('{{#with-block-params as |x|}}{{/with-block-params}}')({ count: 1 }, env, document.body);
  compile('{{#with-block-params as |x y|}}{{/with-block-params}}')({ count: 2 }, env, document.body);
  compile('{{#with-block-params as |x y z|}}{{/with-block-params}}')({ count: 3 }, env, document.body);
});

if (document.createElement('div').namespaceURI) {

QUnit.module("HTML-based compiler (output, svg)", {
  setup: function() {
    helpers = {};
    partials = {};
    hooks = hydrationHooks({lookupHelper : lookupHelper});

    env = {
      hooks: hooks,
      helpers: helpers,
      dom: new DOMHelper(),
      partials: partials
    };
  }
});

test("The compiler can handle namespaced elements", function() {
  var html = '<svg><path stroke="black" d="M 0 0 L 100 100"></path></svg>';
  var template = compile(html);
  var fragment = template({}, env);

  equal(fragment.namespaceURI, svgNamespace, "creates the svg element with a namespace");
  equalTokens(fragment, html);
});

test("The compiler sets namespaces on nested namespaced elements", function() {
  var html = '<svg><path stroke="black" d="M 0 0 L 100 100"></path></svg>';
  var template = compile(html);
  var fragment = template({}, env);

  equal( fragment.childNodes[0].namespaceURI, svgNamespace,
         "creates the path element with a namespace" );
  equalTokens(fragment, html);
});

test("The compiler sets a namespace on an HTML integration point", function() {
  var html = '<svg><foreignObject>Hi</foreignObject></svg>';
  var template = compile(html);
  var fragment = template({}, env);

  equal( fragment.namespaceURI, svgNamespace,
         "creates the path element with a namespace" );
  equal( fragment.childNodes[0].namespaceURI, svgNamespace,
         "creates the path element with a namespace" );
  equalTokens(fragment, html);
});

test("The compiler does not set a namespace on an element inside an HTML integration point", function() {
  var html = '<svg><foreignObject><div></div></foreignObject></svg>';
  var template = compile(html);
  var fragment = template({}, env);

  equal( fragment.childNodes[0].childNodes[0].namespaceURI, xhtmlNamespace,
         "creates the path element with a namespace" );
  equalTokens(fragment, html);
});

test("The compiler pops back to the correct namespace", function() {
  var html = '<svg></svg><svg></svg><div></div>';
  var template = compile(html);
  var fragment = template({}, env);

  equal( fragment.childNodes[0].namespaceURI, svgNamespace,
         "creates the path element with a namespace" );
  equal( fragment.childNodes[1].namespaceURI, svgNamespace,
         "creates the path element with a namespace" );
  equal( fragment.childNodes[2].namespaceURI, xhtmlNamespace,
         "creates the path element with a namespace" );
  equalTokens(fragment, html);
});

test("The compiler preserves capitalization of tags", function() {
  var html = '<svg><linearGradient id="gradient"></linearGradient></svg>';
  var template = compile(html);
  var fragment = template({}, env);

  equalTokens(fragment, html);
});

test("svg can live with hydration", function() {
  var template = compile('<svg></svg>{{name}}');

  var fragment = template({ name: 'Milly' }, env, document.body);
  equal(
    fragment.childNodes[0].namespaceURI, svgNamespace,
    "svg namespace inside a block is present" );
});

test("svg can take some hydration", function() {
  var template = compile('<div><svg>{{name}}</svg></div>');

  var fragment = template({ name: 'Milly' }, env);
  equal(
    fragment.childNodes[0].namespaceURI, svgNamespace,
    "svg namespace inside a block is present" );
  equalTokens( fragment, '<div><svg>Milly</svg></div>',
             "html is valid" );
});

test("root svg can take some hydration", function() {
  var template = compile('<svg>{{name}}</svg>');
  var fragment = template({ name: 'Milly' }, env);
  equal(
    fragment.namespaceURI, svgNamespace,
    "svg namespace inside a block is present" );
  equalTokens( fragment, '<svg>Milly</svg>',
             "html is valid" );
});

test("Block helper allows interior namespace", function() {
  var isTrue = true;
  hooks.content = function(morph, path, context, params, hash, options, env) {
    if (isTrue) {
      morph.update(options.render(context, env, morph.contextualElement));
    } else {
     morph.update(options.inverse(context, env, morph.contextualElement));
    }
  };
  var template = compile('{{#testing}}<svg></svg>{{else}}<div><svg></svg></div>{{/testing}}');

  var fragment = template({ isTrue: true }, env, document.body);
  equal(
    fragment.childNodes[1].namespaceURI, svgNamespace,
    "svg namespace inside a block is present" );

  isTrue = false;
  fragment = template({ isTrue: false }, env, document.body);
  equal(
    fragment.childNodes[1].namespaceURI, xhtmlNamespace,
    "inverse block path has a normal namespace");
  equal(
    fragment.childNodes[1].childNodes[0].namespaceURI, svgNamespace,
    "svg namespace inside an element inside a block is present" );
});

test("Block helper allows namespace to bleed through", function() {
  hooks.content = function(morph, path, context, params, hash, options, env) {
    morph.update(options.render(context, env, morph.contextualElement));
  };

  var template = compile('<div><svg>{{#testing}}<circle />{{/testing}}</svg></div>');

  var fragment = template({ isTrue: true }, env);
  equal( fragment.childNodes[0].namespaceURI, svgNamespace,
         "svg tag has an svg namespace" );
  equal( fragment.childNodes[0].childNodes[0].namespaceURI, svgNamespace,
         "circle tag inside block inside svg has an svg namespace" );
});

test("Block helper with root svg allows namespace to bleed through", function() {
  hooks.content = function(morph, path, context, params, hash, options, env) {
    morph.update(options.render(context, env, morph.contextualElement));
  };

  var template = compile('<svg>{{#testing}}<circle />{{/testing}}</svg>');

  var fragment = template({ isTrue: true }, env);
  equal( fragment.namespaceURI, svgNamespace,
         "svg tag has an svg namespace" );
  equal( fragment.childNodes[0].namespaceURI, svgNamespace,
         "circle tag inside block inside svg has an svg namespace" );
});

test("Block helper with root foreignObject allows namespace to bleed through", function() {
  hooks.content = function(morph, path, context, params, hash, options, env) {
    morph.update(options.render(context, env, morph.contextualElement));
  };

  var template = compile('<foreignObject>{{#testing}}<div></div>{{/testing}}</foreignObject>');

  var fragment = template({ isTrue: true }, env, document.createElementNS(svgNamespace, 'svg'));
  equal( fragment.namespaceURI, svgNamespace,
         "foreignObject tag has an svg namespace" );
  equal( fragment.childNodes[0].namespaceURI, xhtmlNamespace,
         "div inside morph and foreignObject has xhtml namespace" );
});

}
