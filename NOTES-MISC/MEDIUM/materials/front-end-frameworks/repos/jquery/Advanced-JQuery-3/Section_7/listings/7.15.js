$.ajaxSetup({
  accepts: {
    yaml: "application/x-yaml, text/yaml",
  },
  contents: {
    yaml: /yaml/,
  },
  converters: {
    "text yaml": function (textValue) {
      var result = YAML.eval(textValue);
      var errors = YAML.getErrors();
      if (errors.length) {
        throw errors;
      }
      return result;
    },
  },
});

$.ajaxPrefilter(function (options) {
  if (/\.yml$/.test(options.url)) {
    return "yaml";
  }
});

$.getScript("yaml.js").done(function () {
  $.ajax({
    url: "categories.yml",
  }).done(function (data) {
    var cats = "";
    $.each(data, function (category, subcategories) {
      cats += '<li><a href="#">' + category + "</a></li>";
    });

    $(document).ready(function () {
      var $cats = $("#categories").removeClass("hide");
      $("<ul></ul>", {
        html: cats,
      }).appendTo($cats);
    });
  });
});

$(document).on("click", "#categories a", function (event) {
  event.preventDefault();
  $(this)
    .parent()
    .toggleClass("active")
    .siblings(".active")
    .removeClass("active");
  $("#ajax-form").triggerHandler("submit");
});

$(document).ready(function () {
  var $ajaxForm = $("#ajax-form"),
    $response = $("#response"),
    noresults = "There were no search results.",
    failed =
      "Sorry, but the request could not " +
      "reach its destination. Try again later.",
    api = {},
    searchTimeout,
    searchDelay = 300;

  var buildItem = function (item) {
    var title = item.name,
      args = [],
      output = "<li>";

    if (item.type == "method" || !item.type) {
      if (item.signatures[0].params) {
        $.each(item.signatures[0].params, function (index, val) {
          args.push(val.name);
        });
      }
      title = /^jQuery|deferred/.test(title) ? title : "." + title;
      title += "(" + args.join(", ") + ")";
    } else if (item.type == "selector") {
      title += " selector";
    }
    output += '<h3><a href="' + item.url + '">' + title + "</a></h3>";
    output += "<div>" + item.desc + "</div>";
    output += "</li>";

    return output;
  };

  var response = function (json) {
    var output = "";
    if (json && json.length) {
      output += "<ol>";
      $.each(json, function (index, val) {
        output += buildItem(val);
      });
      output += "</ol>";
    } else {
      output += noresults;
    }

    $response.html(output);
  };

  $ajaxForm.on("submit", function (event) {
    event.preventDefault();

    $response.empty();

    var title = $("#title").val(),
      category = $("#categories").find("li.active").text(),
      search = category + "-" + title;
    if (search == "-") {
      return;
    }

    $response.addClass("loading");

    if (!api[search]) {
      api[search] = $.ajax({
        url: "http://book.learningjquery.com/api/",
        dataType: "jsonp",
        data: {
          title: title,
          category: category,
        },
        timeout: 15000,
      });
    }
    api[search]
      .done(response)
      .fail(function () {
        $response.html(failed);
      })
      .always(function () {
        $response.removeClass("loading");
      });
  });

  $("#title").on("keyup", function (event) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      $ajaxForm.triggerHandler("submit");
    }, searchDelay);
  });
});

$.ajaxSetup({
  accepts: {
    yaml: "application/x-yaml, text/yaml",
  },
  contents: {
    yaml: /yaml/,
  },
  converters: {
    "text yaml": (textValue) => YAML.eval(textValue),
  },
});

$.ajaxPrefilter(({ url }) => (/\.yml$/.test(url) ? "yaml" : null));

Promise.all([
  $.getScript("yaml.js").then(() =>
    $.ajax({
      url: "categories.yml",
    })
  ),
  $.ready,
]).then(function ([data]) {
  const output = Object.keys(data)
    .reduce(
      (result, key) =>
        result.concat(
          `<li><strong>${key}</strong></li>`,
          data[key].map((i) => `<li> <a href="#">${i}</a></li>`)
        ),
      []
    )
    .join("");

  $("#categories").removeClass("hide").html(`<ul>${output}</ul>`);
});

$(() => {
  const buildItem = (item) =>
    `
      <li>
        <h3><a href="${item.html_url}">${item.name}</a></h3>
        <div>★ ${item.stargazers_count}</div>
        <div>${item.description}</div>
      </li>
    `;

  const cache = new Map();

  $("#ajax-form").on("submit", (e) => {
    e.preventDefault();

    const search = [
      $("#title").val(),
      new Map([
        ["JavaScript", 'language:"JavaScript"'],
        ["HTML", 'language:"HTML"'],
        ["CSS", 'language:"CSS"'],
        ["5000+", 'stars:">=5000"'],
        ["10000+", 'stars:">=10000"'],
        ["20000+", 'stars:">=20000"'],
        ["", ""],
      ]).get($.trim($("#categories").find("li.active").text())),
    ].join("");

    if (search == "" && category == "") {
      return;
    }

    $("#response").addClass("loading").empty();

    cache
      .set(
        search,
        cache.has(search)
          ? cache.get(search)
          : $.ajax({
              url: "https://api.github.com/search/repositories",
              dataType: "jsonp",
              data: { q: search },
              timeout: 10000,
            })
      )
      .get(search)
      .then((json) => {
        var output = json.data.items.map(buildItem);
        output = output.length ? output.join("") : "no results found";

        $("#response").html(`<ol>${output}</ol>`);
      })
      .catch(() => {
        $("#response").html("Oops. Something went wrong...");
      })
      .always(() => {
        $("#response").removeClass("loading");
      });
  });

  const searchDelay = 300;
  var searchTimeout;

  $("#title").on("keyup", (e) => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
      $(e.target.form).triggerHandler("submit");
    }, searchDelay);
  });

  $(document).on("click", "#categories a", (e) => {
    e.preventDefault();

    $(e.target)
      .parent()
      .toggleClass("active")
      .siblings(".active")
      .removeClass("active");
    $("#ajax-form").triggerHandler("submit");
  });
});
