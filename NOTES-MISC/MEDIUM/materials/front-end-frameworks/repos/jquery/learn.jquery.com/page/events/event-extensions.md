<script>{
	"title": "jQuery Event Extensions",
	"level": "advanced"
}</script>

jQuery offers several ways to extend its event system to provide custom functionality when events are attached to elements. Internally in jQuery, these extensions are primarily used to ensure that standard events such as `submit` and `change` behave consistently across browsers. However, they can also be used to define new events with custom behavior.

This document covers the extensions available starting with jQuery 1.7; a sparsely documented subset of this functionality has been available since jQuery 1.3 but the differences in functionality are extensive. For an overview of special events in earlier versions, see [Ben Alman's jQuery Special Events](http://benalman.com/news/2010/03/jquery-special-events/) article.

<div class="warning">**Note:** jQuery event extensions are an advanced feature; they require a deeper knowledge of both browser behavior and jQuery internals than most of the API. Most users of jQuery will not need to use event extensions, and those who do should use them with care. For example, on a large project with third-party plugins, changing the behavior of standard events such as `click` or `mouseover` can cause serious compatibility issues.</div>

### Events overview and general advice

When writing an event extension, it is essential to understand the flow of events through jQuery's internal event system. For a description of the event system from the API level, including a discussion of event delegation, see the [`.on()`](http://api.jquery.com/on/) method.

To simplify event management, jQuery only attaches a single event handler per element per event type (using `addEventListener` on W3C-compliant browsers or `attachEvent` on older IE) and then dispatches to event handlers that are attached via jQuery's APIs. For example, if three "click" event handlers are attached to an element, jQuery attaches its own handler when the first handler is attached and adds the user's event handler to a list to be executed when the event occurs. For subsequent event handlers, jQuery only adds them to its own internal list since it has already called the browser to attach its solitary handler. Conversely, jQuery removes its own event handler from the browser when the final event of a particular type is removed from the element.

An event can be a _native_ event defined by the W3C and fired by the browser in response to something such as a user clicking a mouse button or pressing a key. It can also be a _custom_ event, triggered only by code via jQuery's `.trigger()` or `.triggerHandler()` methods. Code can also trigger native browser events, which is convenient for simulating user actions.

In general, jQuery does not have intrinsic knowledge of whether an event name may be fired by a browser. So by default, jQuery always attaches an event to the browser when an API call is made to add an event handler for that event. If that event type is never generated by the browser, the only way the handler will be called is if JavaScript code triggers the event. Although there is generally no harm in attaching an unused event name to the browser, the default behavior can be overridden using the special event `setup` hook as described below.

Whenever elements are removed from a document via jQuery, the event system tries to ensure that events and related data are removed from the elements to prevent memory leaks. (Older versions of Internet Explorer are notorious for leaking memory in these situations if not managed carefully.) If an event extension attaches events or creates new objects, it should detach those objects or clear the data when the event is removed by defining `remove` and `teardown` hooks.

jQuery event extension developers should avoid using event names that have special meaning in a DOM setting. Event names such as "click", "change", or "load" have specific semantics defined by the W3C, so using them as custom events can cause unexpected behavior. Generally, jQuery event extensions should _only_ be used for W3C-defined event names when the extension is normalizing behavior across browsers. A common convention to avoid collisions for custom events is to embed a colon or dash in the event type name, since no W3C events use those characters.

Although jQuery's event system is oriented towards delivering DOM events to DOM elements, jQuery methods can be used to attach and trigger events on plain objects. For example, it can be used as a simple publish/subscribe mechanism. Developers of event extensions should attempt to avoid unwanted behavior if their extensions are used in a mixed scenario with DOM and plain objects. The canonical way that jQuery detects a DOM element is to check for `elem.nodeType === 1` on the object.

### jQuery.event.props: Array

jQuery defines an [Event object](https://api.jquery.com/category/events/event-object/) that represents a cross-browser subset of the information available when an event occurs. The `jQuery.event.props` property is an array of string names for properties that are always copied when jQuery processes a _native_ browser event. (Events fired in code by `.trigger()` do not use this list, since the code can construct a `jQuery.Event` object with the needed values and trigger using that object.)

To add a property name to this list, use `jQuery.event.props.push( "newPropertyName" )`. However, be aware that every event processed by jQuery will now attempt to copy this property name from the native browser event to jQuery's constructed event. If the property does not exist for that event type, it will get an undefined value. Adding many properties to this list can significantly reduce event delivery performance, so for infrequently-needed properties it is more efficient to use the value directly from `event.originalEvent` instead. If properties must be copied, you are strongly advised to use `jQuery.event.fixHooks` as of version 1.7.

### jQuery.event.fixHooks: Object

The `fixHooks` interface provides a per-event-type way to extend or normalize the event object that jQuery creates when it processes a _native_ browser event. A `fixHooks` entry is an object that has two properties, each being optional:

`props`: Array:
Strings representing properties that should be copied from the browser's event object to the jQuery event object. If omitted, no additional properties are copied beyond the standard ones that jQuery copies and normalizes (e.g. `event.target` and `event.relatedTarget`).

`filter`: Function( event, originalEvent ):
jQuery calls this function after it constructs the `jQuery.Event` object, copies standard properties from `jQuery.event.props`, and copies the `fixHooks`-specific props (if any) specified above. The function can create new properties on the event object or modify existing ones. The second argument is the browser's native event object, which is also available in `event.originalEvent`.

Note that for all events, the browser's native event object is available in `event.originalEvent`; if the jQuery event handler examines the properties there instead of jQuery's normalized `event` object, there is no need to create a `fixHooks` entry to copy or modify the properties.

For example, to set a hook for the "drop" event that copies the `dataTransfer` property, assign an object to `jQuery.event.fixHooks.drop`:

```
jQuery.event.fixHooks.drop = {
	props: [ "dataTransfer" ]
};
```

Since `fixHooks` is an advanced feature and rarely used externally, jQuery does not include code or interfaces to deal with conflict resolution. If there is a chance that some other code may be assigning `fixHooks` to the same events, the code should check for an existing hook and take appropriate measures. A simple solution might look like this:

```
if ( jQuery.event.fixHooks.drop ) {
	throw new Error( "Someone else took the jQuery.event.fixHooks.drop hook!" );
}

jQuery.event.fixHooks.drop = {
	props: [ "dataTransfer" ]
};
```

When there are known cases of different plugins wanting to attach to the drop hook, this solution might be more appropriate:

```
var existingHook = jQuery.event.fixHooks.drop;

if ( !existingHook ) {
	jQuery.event.fixHooks.drop = {
		props: [ "dataTransfer" ]
	};
} else {
	if ( existingHook.props ) {
		existingHook.props.push( "dataTransfer" );
	} else {
		existingHook.props = [ "dataTransfer" ];
	}
}
```

### Special event hooks

The jQuery special event hooks are a set of per-event-name functions and properties that allow code to control the behavior of event processing within jQuery. The mechanism is similar to `fixHooks` in that the special event information is stored in `jQuery.event.special.NAME`, where `NAME` is the name of the special event. Event names are case sensitive.

As with `fixHooks`, the special event hooks design assumes it will be very rare that two unrelated pieces of code want to process the same event name. Special event authors who need to modify events with existing hooks will need to take precautions to avoid introducing unwanted side-effects by clobbering those hooks.

#### noBubble: Boolean

Indicates whether this event type should be bubbled when the `.trigger()` method is called; by default it is `false`, meaning that a triggered event will bubble to the element's parents up to the document (if attached to a document) and then to the window. Note that defining `noBubble` on an event will effectively prevent that event from being used for delegated events with `.trigger()`.

#### bindType: String, delegateType: String

When defined, these string properties specify that a special event should be handled like another event type until the event is delivered. The `bindType` is used if the event is attached directly, and the `delegateType` is used for delegated events. These types are generally DOM event types, and _should not_ be a special event themselves.

The behavior of these properties is easiest to see with an example. Assume a special event defined as follows:

```
jQuery.event.special.pushy = {
	bindType: "click",
	delegateType: "click"
};
```

When these properties are defined, the following behavior occurs in the jQuery event system:

- Event handlers for the "pushy" event are actually attached to "click" — both directly bound and delegated events.
- Special event hooks for "click" are called if they exist, _except_ the `handle` hook for "pushy" is called when an event is delivered if one exists.
- Event handlers for "pushy" must be removed using the "pushy" event name, and are unaffected if "click" events are removed from the same elements.

So given the special event above, this code shows that a pushy isn't removed by removing clicks. That might be an effective way to defend against an ill-behaved plugin that didn't namespace its removal of click events, for example:

```
var elem = $( "p" );

elem.on( "click", function( event ) {
	$( "body" ).append( "I am a " + event.type + "!" );
});

elem.on( "pushy", function( event ) {
	$( "body" ).append( "I am pushy but still a " + event.type + "!" );
});

elem.trigger( "click" ); // Triggers both handlers

elem.off( "click" );

elem.trigger( "click" ); // Still triggers "pushy"

elem.off( "pushy" );
```

These two properties are often used in conjunction with a `handle` hook function; the hook might, for example, change the event name from "click" to "pushy" before calling event handlers. See below for an example.

#### The handleObj object

Many of the special event hook functions below are passed a `handleObj` object that provides more information about the event, how it was attached, and its current state. This object and its contents should be treated as read-only data, and only the properties below are documented for use by special event handlers. For the discussion below, assume an event is attached with this code:

```
$( ".dialog" ).on( "click.myPlugin", "button", {
	mydata: 42
}, myHandler );
```

`type`: String:
The type of event, such as `"click"`. When special event mapping is used via `bindType` or `delegateType`, this will be the mapped type.

`origType`: String:
The original type name (in this case, `"click"`) regardless of whether it was mapped via `bindType` or `delegateType`. So when a "pushy" event is mapped to "click" its `origType` would be "pushy". See the examples in those special event properties above for more detail.

`namespace`: String:
Namespace(s), if any, provided when the event was attached, such as `"myPlugin"`. When multiple namespaces are given, they are separated by periods and sorted in ascending alphabetical order. If no namespaces are provided, this property is an empty string.

`selector`: String:
For delegated events, this is the selector used to filter descendant elements and determine if the handler should be called. In the example it is `"button"`. For directly bound events, this property is `null`.

`data`: Object:
The data, if any, passed to jQuery during event binding, e.g. `{ myData: 42 }`. If the data argument was omitted or `undefined`, this property is `undefined` as well.

`handler`: function( event: jQuery.Event ):
Event handler function passed to jQuery during event binding; in the example it is a reference to `myHandler`. If `false` was passed during event binding, the handler refers to a single shared function that simply returns `false`.

#### setup: function( data: Object, namespaces, eventHandle: function )

The setup hook is called the first time an event of a particular type is attached to an element; this provides the hook an opportunity to do processing that will apply to all events of this type on this element. The `this` keyword will be a reference to the element where the event is being attached and `eventHandle` is jQuery's event handler function. In most cases the `namespaces` argument should not be used, since it only represents the namespaces of the _first_ event being attached; subsequent events may not have this same namespaces.

This hook can perform whatever processing it desires, including attaching its own event handlers to the element or to other elements and recording setup information on the element using the `jQuery.data()` method. If the setup hook wants jQuery to add a browser event (via `addEventListener` or `attachEvent`, depending on browser) it should return `false`. In all other cases, jQuery will not add the browser event, but will continue all its other bookkeeping for the event. This would be appropriate, for example, if the event was never fired by the browser but invoked by `.trigger()`. To attach the jQuery event handler in the setup hook, use the `eventHandle` argument.

#### teardown: function()

The teardown hook is called when the final event of a particular type is removed from an element. The `this` keyword will be a reference to the element where the event is being cleaned up. This hook should return `false` if it wants jQuery to remove the event from the browser's event system (via `removeEventListener` or `detachEvent`). In most cases, the setup and teardown hooks should return the same value.

If the setup hook attached event handlers or added data to an element through a mechanism such as `jQuery.data()`, the teardown hook should reverse the process and remove them. jQuery will generally remove the data and events when an element is totally removed from the document, but failing to remove data or events on teardown will cause a memory leak if the element stays in the document.

#### add: function( handleObj )

Each time an event handler is added to an element through an API such as `.on()`, jQuery calls this hook. The `this` keyword will be the element to which the event handler is being added, and the `handleObj` argument is as described in the section above. The return value of this hook is ignored.

#### remove: function( handleObj )

When an event handler is removed from an element using an API such as `.off()`, this hook is called. The `this` keyword will be the element where the handler is being removed, and the `handleObj` argument is as described in the section above. The return value of this hook is ignored.

#### trigger: function( event: jQuery.Event, data: Object )

Called when the `.trigger()` or `.triggerHandler()` methods are used to trigger an event for the special type from code, as opposed to events that originate from within the browser. The `this` keyword will be the element being triggered, and the event argument will be a `jQuery.Event` object constructed from the caller's input. At minimum, the event type, data, namespace, and target properties are set on the event. The data argument represents additional data passed by `.trigger()` if present.

The trigger hook is called early in the process of triggering an event, just after the `jQuery.Event` object is constructed and before any handlers have been called. It can process the triggered event in any way, for example by calling `event.stopPropagation()` or `event.preventDefault()` before returning. If the hook returns `false`, jQuery does not perform any further event triggering actions and returns immediately. Otherwise, it performs the normal trigger processing, calling any event handlers for the element and bubbling the event (unless propagation is stopped in advance or `noBubble` was specified for the special event) to call event handlers attached to parent elements.

#### \_default: function( event: jQuery.Event, data: Object )

When the `.trigger()` method finishes running all the event handlers for an event, it also looks for and runs any method on the target object by the same name unless of the handlers called `event.preventDefault()`. So, `.trigger( "submit" )` will execute the `submit()` method on the element if one exists. When a `_default` hook is specified, the hook is called just prior to checking for and executing the element's default method. If this hook returns the value `false` the element's default method will be called; otherwise it is not.

#### handle: function( event: jQuery.Event, data: Object )

jQuery calls a handle hook when the event has occurred and jQuery would normally call the user's event handler specified by `.on()` or another event binding method. If the hook exists, jQuery calls it _instead of_ that event handler, passing it the event and any data passed from `.trigger()` if it was not a native event. The `this` keyword is the DOM element being handled, and `event.handleObj` property has the detailed event information.

Based in the information it has, the handle hook should decide whether to call the original handler function which is in `event.handleObj.handler`. It can modify information in the event object before calling the original handler, but _must restore_ that data before returning or subsequent unrelated event handlers may act unpredictably. In most cases, the handle hook should return the result of the original handler, but that is at the discretion of the hook.
The handle hook is unique in that it is the only special event function hook that is called under its original special event name when the type is mapped using `bindType` and `delegateType`. For that reason, it is almost always an error to have anything other than a handle hook present if the special event defines a `bindType` and `delegateType`, since those other hooks will never be called.

#### Example: Multiclick event

This `multiclick` special event maps itself into a standard click event, but uses a handle hook so that it can monitor the event and only deliver it when the user clicks on the element a multiple of the number of times specified during event binding.

The hook stores the current click count in the data object, so multiclick handlers on different elements don't interfere with each other. It changes the event type to the original "multiclick" type before calling the handler and restores it to the mapped "click" type before returning:

```
jQuery.event.special.multiclick = {
	delegateType: "click",
	bindType: "click",
	handle: function( event ) {
		var handleObj = event.handleObj;
		var targetData = jQuery.data( event.target );
		var ret = null;

		// If a multiple of the click count, run the handler
		targetData.clicks = ( targetData.clicks || 0 ) + 1;

		if ( targetData.clicks % event.data.clicks === 0 ) {
			event.type = handleObj.origType;
			ret = handleObj.handler.apply( this, arguments );
			event.type = handleObj.type;
			return ret;
		}
	}
};

// Sample usage
$( "p" ).on( "multiclick", {
	clicks: 3
}, function( event ) {
	alert( "clicked 3 times" );
});
```
