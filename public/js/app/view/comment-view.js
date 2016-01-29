define(['App', 'underscore', 'backbone', 'hbs!template/comment', 'hbs!template/commentMOAR', 'view/hover-img-view', 'view/basem-view', 'model/comment'],
  function(App, _, Backbone, commentTmpl, CommentMOAR, HoverImgView, BaseView, CommentModel) {
    return BaseView.extend({
      template: commentTmpl,
      events: {
        'click .noncollapsed .expand': "hideThread",
        'click .collapsed .expand': "showThread",
        'click .cancel': 'hideUserInput',
        'click .MOAR': 'loadMOAR',
        'click .upArrow': 'upvote',
        'click .downArrow': 'downvote',
        'mouseover .outBoundLink': 'commentLinkHover',
        'click .report': 'reportShow',
        'click .reportConfirmYes': 'reportYes',
        'click .reportConfirmNo': 'reportShow',
        'submit .commentreply': 'comment',
        'click .replyToggle': 'toggleReply',
        'click .mdHelpShow': 'showMdHelp',
        'click .mdHelpHide': 'hideMdHelp',
        'keyup .userTxtInput': 'keyPressComment'
      },
      regions: {
        'hoverImgParent': '.hoverImgParent:first'
      },
      ui: {
        'upArrow': '.upArrow',
        'downArrow': '.downArrow',
        'midcol': '.midcol',
        'noncollapsed': '.noncollapsed',
        'collapsed': '.collapsed',
        'child': '.child',
        'commentreply': '.commentreply',
        'text': '.text',
        'status': '.status',
        'mdHelp': '.mdHelp',
        'mdHelpShow': '.mdHelpShow',
        'mdHelpHide': '.mdHelpHide',
        'reportConfirm': '.reportConfirm',
        'reportConfirmYes': '.reportConfirmYes',
        'userTxtInput': '.userTxtInput',
        'liveTextarea': '.liveTextarea',
		'replies': '.replies'
      },
      initialize: function(options) {
        _.bindAll(this);
        var self = this;
        this.model = options.model
        this.collection = this.model.get('replies')
        this.originalPoster = options.originalPoster
        this.blinking = '<img class="blinkingFakeInput" src="/img/text_cursor.gif" />' //baseview uses this 
        this.commentsDisabled = options.commentsDisabled
        this.model.set('commentsDisabled', this.commentsDisabled)
        this.name = this.model.get('name')
        this.id = this.model.get('id')
        this.mainPostId = options.mainPostId

        if (this.model.get('author') === this.originalPoster) {
          this.model.set('showOriginalPoster', 'submitter')
        }

        if (this.model.get('kind') == 'more') {
          this.template = CommentMOAR
        } else {
          this.template = commentTmpl
        }
      },
      onShow: function() {
        var self = this
        this.addOutboundLink()
        this.permalinkParent = this.model.get('permalinkParent')
        this.setupTextareaExpanding()
      },
      onBeforeDestroy: function() {
		if(typeof this.ui.userTxtInput !== 'string'){
			 this.ui.userTxtInput.off('blur focus');
		}       
      },
      //add data-external and a special class to any link in a comment
      //once the links have the class outBoundLink on them, they will no longer trigger the hover view
      addOutboundLink: function() {
        this.$('.hoverImgParent a').addClass('outBoundLink').attr("data-bypass", "true"); //makes the link external to be clickable
        this.$('.hoverImgParent a').attr('target', '_blank');
      },
      loadMOAR: function(e) {
        e.preventDefault()
        e.stopPropagation()
        $(this.el).html("<div class='loadingS'></div>")
        var self = this

        var params = {
          link_id: this.mainPostId,
          api_type: 'json',
          children: this.model.get('children').join(","),
          byPassAuth: true
        };
        console.log('MOAR=', params)

        if (this.checkIfLoggedIn() === true) {
          this.api("api/morechildren.json", 'POST', params, this.gotDataFromRenderMoar);
        } else {
          this.apiNonAuth("api/morechildren.json", 'POST', params, this.gotDataFromRenderMoar);
        }

      },
      gotDataFromRenderMoar: function(data) {
        var self = this
        if (_.has(data, 'json.data.things') && data.json.data.things.length > 0) {

          var newComments = []

          _.each(data.json.data.things, function(x) {
            newComments.push(new CommentModel(x, {
              parse: true
            }))
          })
          self.reRenderMOAR(newComments)
        } else {
          //the request failed so give the user the option to try again
          this.render()
        }

      },
      reRenderMOAR: function(newComments) {
		var self=this
        if (typeof newComments !== 'undefined' && newComments.length > 0) {
          //pluck the first model in the collection and set it as this model for reRendering
          this.model = newComments[0]

          this.model.set('permalink', this.permalinkParent + this.model.get('id'))
          this.model.set('permalinkParent', this.permalinkParent)

          //change template back to normal comment template
          this.template = commentTmpl
          this.$el.empty()
          this.render()
		  this.addOutboundLink()
		  
		  setTimeout(function(){
			   // self._parent.collection.add(_.tail(newComments)) //add all but the first comment to the collection
			    self._parent.addAry(_.tail(newComments)) //add all but the first comment to the collection
		  },20)
        
         
        }
      },

      hideThread: function(e) {
        e.preventDefault()
        e.stopPropagation()
        this.ui.noncollapsed.hide()
        this.ui.collapsed.show()
        this.ui.child.hide()
        this.ui.midcol.hide()
      },
      showThread: function(e) {
        e.preventDefault()
        e.stopPropagation()
        this.ui.collapsed.hide()
        this.ui.noncollapsed.show()
        this.ui.child.show()
        this.ui.midcol.show()
      },
      //shows the comment reply textbox
      toggleReply: function(e) {
        e.preventDefault()
        e.stopPropagation()
        this.ui.commentreply.toggle().find('.text').focus()
        if (!this.replyHasBeenToggledOnce) {
          this.setupTextareaExpanding()
          this.replyHasBeenToggledOnce = true
        }
      },
      //attempts to create a new comment
      comment: function(e) {
        e.preventDefault()
        e.stopPropagation()

        if (this.checkIfLoggedIn() === true) {
          var self = this

          var id = this.model.get('name')
            //var text = this.$('#text' + id).val()
          var text = this.ui.text.val()
          text = this.sterilize(text) //clean the input

          var params = {
            api_type: 'json',
            thing_id: id,
            text: text,
            uh: $.cookie('modhash')
          };
          console.log(params)

          this.api("/api/comment", 'POST', params, function(data) {
            console.log("comment done", data)
            self.commentCallback(data)
          });
        } else {
          this.showLoginBox()
        }
      }, //callback after trying to write a comment

      commentCallback: function(data) {
        console.log('callback comment=', data)
        if (_.has(data, 'json.data.things') && data.json.data.things.length > 0) {
          this.ui.status.html('<span class="success">success!</span>')
          this.ui.text.val('')
          this.hideUserInput()

          var newComments = []

          _.each(data.json.data.things, function(x) {
            newComments.push(new CommentModel(x, {
              parse: true
            }))
          })

          this._parent.collection.add(newComments)
        } else {

          var msgAry = ((data || {}).json || {}).errors;
          var msg = 'An error has happened while posting your comment'
          if (typeof msgAry[0] !== 'undefined' && typeof msgAry[0][1] !== 'undefined') {
            msg = msgAry[0][1]
          }

          this.ui.status.html('<div class="error">' + msg + '</div>')

        }
      },
      commentLinkHover: function(e) {
        e.preventDefault()
        e.stopPropagation()
        if (App.settings.get('cmtLoad') === true) {
          if (App.Delay !== true) {
            var target = $(e.currentTarget)

            var url = $(target).attr("href")

            var youtubeID = this.youtubeChecker(url);
            //check if the url is an image we can embed
            if (youtubeID === false) {
              url = url.replace(/(\?.*)|(#.*)|(&.*)/g, "")
            }
            if (this.checkIsImg(url) === false) {
              //URL is NOT an image
              //try and fix an imgur link?
              url = this.fixImgur(url)
            }

            if (url !== false || youtubeID !== false) {

              var ahrefDescription = $(target).text()
              if (!ahrefDescription) {
                ahrefDescription = url
              }

              var originalText = $('.outBoundLink:first').parent().parent().text().trim()
              var originalHtml = this.$('.outBoundLink:first').parent().parent().html()
              if (youtubeID) {
                url = $(target).attr("href") //in case it was a youtube video we should reset the url link to pass into the view
              }

              this.hoverImgParent.show(new HoverImgView({
                url: url,
                ahrefDescription: ahrefDescription,
                originalText: originalText,
                originalHtml: originalHtml,
                youtubeID: youtubeID

              }))

            }
          }
        }
      },
      fetchError: function(response, error) {
        console.log("fetch error, lets retry")
      },
      loaded: function(model, res) {
        this.$('.loading').hide()
        this.render();
      }
    });
  });
