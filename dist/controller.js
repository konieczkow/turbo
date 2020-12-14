import { BrowserAdapter } from "./browser_adapter";
import { FormSubmitObserver } from "./form_submit_observer";
import { FrameRedirector } from "./frame_redirector";
import { History } from "./history";
import { LinkClickObserver } from "./link_click_observer";
import { Location } from "./location";
import { Navigator } from "./navigator";
import { PageObserver } from "./page_observer";
import { ScrollObserver } from "./scroll_observer";
import { StreamMessage } from "./stream_message";
import { StreamObserver } from "./stream_observer";
import { isAction } from "./types";
import { closest, dispatch } from "./util";
import { View } from "./view";
import { fetchMethodFromString } from "./fetch_request";
var Controller = /** @class */ (function () {
    function Controller() {
        this.adapter = new BrowserAdapter(this);
        this.navigator = new Navigator(this);
        this.history = new History(this);
        this.view = new View(this);
        this.pageObserver = new PageObserver(this);
        this.linkClickObserver = new LinkClickObserver(this);
        this.formSubmitObserver = new FormSubmitObserver(this);
        this.scrollObserver = new ScrollObserver(this);
        this.streamObserver = new StreamObserver(this);
        this.frameRedirector = new FrameRedirector(document.documentElement);
        this.enabled = true;
        this.progressBarDelay = 500;
        this.started = false;
    }
    Controller.prototype.start = function () {
        if (!this.started) {
            this.pageObserver.start();
            this.linkClickObserver.start();
            this.formSubmitObserver.start();
            this.scrollObserver.start();
            this.streamObserver.start();
            this.frameRedirector.start();
            this.history.start();
            this.started = true;
            this.enabled = true;
        }
    };
    Controller.prototype.disable = function () {
        this.enabled = false;
    };
    Controller.prototype.stop = function () {
        if (this.started) {
            this.pageObserver.stop();
            this.linkClickObserver.stop();
            this.formSubmitObserver.stop();
            this.scrollObserver.stop();
            this.streamObserver.stop();
            this.frameRedirector.stop();
            this.history.stop();
            this.started = false;
        }
    };
    Controller.prototype.registerAdapter = function (adapter) {
        this.adapter = adapter;
    };
    Controller.prototype.visit = function (location, options) {
        if (options === void 0) { options = {}; }
        this.navigator.proposeVisit(Location.wrap(location), options);
    };
    Controller.prototype.startVisitToLocation = function (location, restorationIdentifier, options) {
        this.navigator.startVisit(Location.wrap(location), restorationIdentifier, options);
    };
    Controller.prototype.connectStreamSource = function (source) {
        this.streamObserver.connectStreamSource(source);
    };
    Controller.prototype.disconnectStreamSource = function (source) {
        this.streamObserver.disconnectStreamSource(source);
    };
    Controller.prototype.renderStreamMessage = function (message) {
        document.documentElement.appendChild(StreamMessage.wrap(message).fragment);
    };
    Controller.prototype.clearCache = function () {
        this.view.clearSnapshotCache();
    };
    Controller.prototype.setProgressBarDelay = function (delay) {
        this.progressBarDelay = delay;
    };
    Object.defineProperty(Controller.prototype, "location", {
        get: function () {
            return this.history.location;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Controller.prototype, "restorationIdentifier", {
        get: function () {
            return this.history.restorationIdentifier;
        },
        enumerable: false,
        configurable: true
    });
    // History delegate
    Controller.prototype.historyPoppedToLocationWithRestorationIdentifier = function (location) {
        if (this.enabled) {
            this.navigator.proposeVisit(location, { action: "restore", historyChanged: true });
        }
        else {
            this.adapter.pageInvalidated();
        }
    };
    // Scroll observer delegate
    Controller.prototype.scrollPositionChanged = function (position) {
        this.history.updateRestorationData({ scrollPosition: position });
    };
    // Link click observer delegate
    Controller.prototype.willFollowLinkToLocation = function (link, location) {
        return this.turboIsEnabled(link)
            && this.locationIsVisitable(location)
            && this.applicationAllowsFollowingLinkToLocation(link, location);
    };
    Controller.prototype.followedLinkToLocation = function (link, location) {
        var action = this.getActionForLink(link);
        this.visit(location, { action: action });
    };
    // Navigator delegate
    Controller.prototype.allowsVisitingLocation = function (location) {
        return this.applicationAllowsVisitingLocation(location);
    };
    Controller.prototype.visitProposedToLocation = function (location, options) {
        this.adapter.visitProposedToLocation(location, options);
    };
    Controller.prototype.visitStarted = function (visit) {
        this.notifyApplicationAfterVisitingLocation(visit.location);
    };
    Controller.prototype.visitCompleted = function (visit) {
        this.notifyApplicationAfterPageLoad(visit.getTimingMetrics());
    };
    // Form submit observer delegate
    Controller.prototype.willSubmitForm = function (form, submitter) {
        var isHttpMethod = !!fetchMethodFromString((submitter === null || submitter === void 0 ? void 0 : submitter.getAttribute("formmethod")) || form.method);
        var turbolinksEnabled = submitter ?
            this.turboIsEnabled(submitter) && this.turboIsEnabled(form) :
            this.turboIsEnabled(form);
        return isHttpMethod && turbolinksEnabled;
    };
    Controller.prototype.formSubmitted = function (form, submitter) {
        this.navigator.submitForm(form, submitter);
    };
    // Page observer delegate
    Controller.prototype.pageBecameInteractive = function () {
        this.view.lastRenderedLocation = this.location;
        this.notifyApplicationAfterPageLoad();
    };
    Controller.prototype.pageLoaded = function () {
    };
    Controller.prototype.pageInvalidated = function () {
        this.adapter.pageInvalidated();
    };
    // Stream observer delegate
    Controller.prototype.receivedMessageFromStream = function (message) {
        this.renderStreamMessage(message);
    };
    // View delegate
    Controller.prototype.viewWillRender = function (newBody) {
        this.notifyApplicationBeforeRender(newBody);
    };
    Controller.prototype.viewRendered = function () {
        this.view.lastRenderedLocation = this.history.location;
        this.notifyApplicationAfterRender();
    };
    Controller.prototype.viewInvalidated = function () {
        this.pageObserver.invalidate();
    };
    Controller.prototype.viewWillCacheSnapshot = function () {
        this.notifyApplicationBeforeCachingSnapshot();
    };
    // Application events
    Controller.prototype.applicationAllowsFollowingLinkToLocation = function (link, location) {
        var event = this.notifyApplicationAfterClickingLinkToLocation(link, location);
        return !event.defaultPrevented;
    };
    Controller.prototype.applicationAllowsVisitingLocation = function (location) {
        var event = this.notifyApplicationBeforeVisitingLocation(location);
        return !event.defaultPrevented;
    };
    Controller.prototype.notifyApplicationAfterClickingLinkToLocation = function (link, location) {
        return dispatch("turbo:click", { target: link, data: { url: location.absoluteURL }, cancelable: true });
    };
    Controller.prototype.notifyApplicationBeforeVisitingLocation = function (location) {
        return dispatch("turbo:before-visit", { data: { url: location.absoluteURL }, cancelable: true });
    };
    Controller.prototype.notifyApplicationAfterVisitingLocation = function (location) {
        return dispatch("turbo:visit", { data: { url: location.absoluteURL } });
    };
    Controller.prototype.notifyApplicationBeforeCachingSnapshot = function () {
        return dispatch("turbo:before-cache");
    };
    Controller.prototype.notifyApplicationBeforeRender = function (newBody) {
        return dispatch("turbo:before-render", { data: { newBody: newBody } });
    };
    Controller.prototype.notifyApplicationAfterRender = function () {
        return dispatch("turbo:render");
    };
    Controller.prototype.notifyApplicationAfterPageLoad = function (timing) {
        if (timing === void 0) { timing = {}; }
        return dispatch("turbo:load", { data: { url: this.location.absoluteURL, timing: timing } });
    };
    // Private
    Controller.prototype.getActionForLink = function (link) {
        var action = link.getAttribute("data-turbo-action");
        return isAction(action) ? action : "advance";
    };
    Controller.prototype.turboIsEnabled = function (element) {
        var container = closest(element, "[data-turbo]");
        if (container) {
            return container.getAttribute("data-turbo") != "false";
        }
        else {
            return true;
        }
    };
    Controller.prototype.locationIsVisitable = function (location) {
        return location.isPrefixedBy(this.view.getRootLocation()) && location.isHTML();
    };
    return Controller;
}());
export { Controller };
//# sourceMappingURL=controller.js.map