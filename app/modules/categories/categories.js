'use strict';

angular.module('liveJudgingAdmin.categories', ['ngRoute'])

.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/categories', {
    templateUrl: 'modules/categories/categories.html',
    controller: 'CategoriesCtrl'
  });
}])

.controller('CategoriesCtrl', ['$cookies', '$location', '$rootScope', '$scope', 'CategoryManagementService', 'CatWatchService', 'TeamManagementService',
    function($cookies, $location, $rootScope, $scope, CategoryManagementService, CatWatchService, TeamManagementService) {

        var catWatchService = CatWatchService($cookies, $scope);
        catWatchService.init();

        var categoryManagementService = CategoryManagementService($scope, $cookies);
        categoryManagementService.getCategories();

        var teamManagementService = TeamManagementService($scope, $cookies);

        $scope.createNewCategory = function() {
            categoryManagementService.createNewCategory();
        }

        $scope.editSelectedCategory = function() {
            categoryManagementService.editCategory();       
        }

        $scope.deleteCategory = function() {
            categoryManagementService.deleteCategory();
        }

        $scope.deleteTeam = function(itemId) {
            var team = teamManagementService.getTeamByID(parseInt(itemId));
            $cookies.putObject('selectedTeam', team);
            teamManagementService.deleteTeam();
        }

        $scope.removeTeamFromCategory = function(itemId) {

        }

        $scope.changeCategoryModalView = function(view, event, category) {
            $scope.categoryModalView = view;
            $scope.openCategoryModal();
            if (view === 'edit') {
                $scope.updateSelectedCategory(category);
                $scope.populateCategoryModal(category);
                event.stopPropagation();
            }
        }

        $scope.populateCategoryModal = function(category) {
            $scope.categoryID = category.id;
            $scope.categoryName = category.label;
            $scope.categoryDesc = category.desc;
            $scope.categoryTime = category.time;
            $scope.categoryColor = category.color;
        }

        $scope.openCategoryModal = function() {
            $('#category-modal').modal('show');
        }

        $scope.closeCategoryModal = function() {
            $scope.categoryID = '';
            $scope.categoryName = '';
            $scope.categoryDesc = '';
            $scope.categoryTime = '';
            $scope.categoryColor = 'FFFFFF'; 
            $scope.categoryModalError = null;
            $('#category-modal').modal('hide');
            $scope.updateSelectedCategory($cookies.getObject('uncategorized'));
        }

        $scope.updateSelectedCategory = function(category) {
            if ($location.path().includes('teams')) {
                teamManagementService.updateSelectedCategory(category);
            }

            if (category) {
               $cookies.putObject('selectedCategory', category);   
            } else {
                $cookies.remove('selectedCategory');
            }
        }

        $scope.transferItemToCategory = function(categoryId, itemId) {
            if ($location.path().includes('teams')) {
                teamManagementService.transferTeamToCategory(categoryId, itemId);
            }            
        }

        $scope.viewCategoryDetails = function(cat) {
            $scope.updateSelectedCategory(cat);

            if ($location.path().includes('teams')) {
                teamManagementService.changeView('selectedCategory');
            }

            // if ($location.path().includes('judges'))
            // if ($location.path().includes('rubrics'))
        }
    }
])

.factory('CatWatchService', function($rootScope) {
    return function($cookies, $scope) {
        var service = {};

        service.init = function() {
            $scope.$watch(function() { 
                return $rootScope.categories;
            }, function(newValue) {
                $scope.categories = newValue;
            }, true);

            $scope.$watch(function() {
                return $cookies.getObject('uncategorized');
            }, function(newValue) {
                $scope.uncategorized = newValue;
            }, true);

            $scope.$watch(function() {
                return $cookies.get('teamView');
            }, function(newValue) {
                $scope.teamView = newValue;
            }, true);
        };

        return service;
    }
})

.factory('CategoryManagementService', ['$cookies', '$log', '$rootScope', 'CategoryRESTService', 'CurrentUserService',
    function($cookies, $log, $rootScope, CategoryRESTService, CurrentUserService) {
    return function($scope, $cookies) {
        var authHeader = CurrentUserService.getAuthHeader();
        var eventId = $cookies.getObject('selected_event').id;

        var categoryManagement = {};
            
        categoryManagement.getCategories = function() {
            CategoryRESTService(authHeader).categories.get({event_id: eventId}).$promise.then(function(resp) {
                angular.forEach(resp.event_categories, function(category) {
                    if (category.label === 'Uncategorized') {
                        category.color = '#BBBBBB';
                        $cookies.putObject('uncategorized', category);
                    }
                    category.color = categoryManagement.convertColorToHex(category.color);
                });
                $rootScope.categories = resp.event_categories;

            }).catch(function() {
                console.log('Error getting categories.');
            });
        };

        categoryManagement.createNewCategory = function() {
            if (!validateForm(false)) {
                return;
            }
            var newCategory = {
                name: $scope.categoryName,
                desc: $scope.categoryDesc,
                time: $scope.categoryTime,
                color: $scope.categoryColor,
                teams: [],
                judges: []
            };      
            var categoryReq = {
                label: newCategory.name,
                description: newCategory.desc,
                due_at: newCategory.time,
                color: convertColorToDecimal(newCategory.color)
            };
            var connection = CategoryRESTService(authHeader);
            connection.new_category.create({event_id: eventId}, categoryReq).$promise.then(function(resp) {
                var returnedCategoryID = resp.event_category.id;
                newCategory.id = returnedCategoryID;
                resp.event_category.color = categoryManagement.convertColorToHex(resp.event_category.color);
                // Save category objects in cookie.
                var currentCats = $rootScope.categories;
                if (currentCats) {
                    currentCats.push(resp.event_category);
                    $rootScope.categories = currentCats;
                } else {
                    $rootScope.categories = resp.event_category;
                }

                $scope.closeCategoryModal();
                $log.log("New category created: " + JSON.stringify(newCategory));
                $log.log("Category list updated: " + $rootScope.categories.length);
            }).catch(function() {
                $scope.closeCategoryModal();
                $scope.errorMessage = 'Error creating category on server.';
                $log.log($scope.errorMessage);
            });
        }

        categoryManagement.editCategory = function() {
            if (!validateForm(true)) {
                return;
            }
            var updatedCategory = {
                id: $scope.categoryID,
                name: $scope.categoryName,
                desc: $scope.categoryDesc,
                time: $scope.categoryTime,
                color: $scope.categoryColor,
                teams: $scope.selectedCategory.teams // Projects have not changed
                //judges: $scope.selectedCategory.judges // Judges have not changed
            }
            var categoryReq = {
                label: updatedCategory.name,
                description: updatedCategory.desc,
                due_at: updatedCategory.time,
                color: convertColorToDecimal(updatedCategory.color)
            }
            var connection = CategoryRESTService(authHeader);
            connection.category.update({id: updatedCategory.id}, categoryReq).$promise.then(function(resp) {
                categoryManagement.getCategories();
                $scope.closeCategoryModal();
                $log.log('Category successfully edited: ' + JSON.stringify(updatedCategory));
            }).catch(function() {
                $scope.closeCategoryModal();
                $scope.errorMessage = 'Error editing category on server.';
                $log.log($scope.errorMessage);
            });
        }

        categoryManagement.deleteCategory = function() {
            var catId = $cookies.getObject('selectedCategory').id;
            var connection = CategoryRESTService(authHeader);
            connection.category.delete({id: catId}).$promise.then(function(resp) {
                var cats = $rootScope.categories;
                for (var i = 0; i < cats.length; i++) {
                    if (cats[i].id == catId) {
                        cats.splice(i, 1);
                        break;
                    }
                }
                $rootScope.categories = cats;
                $scope.closeCategoryModal();
                $log.log('Successfully deleted category.');
            }).catch(function() {
                $scope.errorMessage = 'Error deleting catgory.';
                $log.log($scope.errorMessage);
            });
        }

        var isEmpty = function(str) {
        return (!str || 0 === str.length);
        }

        var convertColorToDecimal = function(hexColor) {
            hexColor = hexColor.substring(1, hexColor.length);
            return parseInt(hexColor, 16);
        }

        categoryManagement.convertColorToHex = function(decimalColor) {
            var hexColor = decimalColor.toString(16);
            var lengthDiff = 6 - hexColor.length;
            var prefix = '#';
            if (lengthDiff > 0) {
                prefix += Array(lengthDiff + 1).join('0');
            }
            return prefix + hexColor;
        }

        var validateForm = function(isEdit) {
            var name = $scope.categoryName,
                time = $scope.categoryTime,
                color = $scope.categoryColor/*.toLowerCase()*/;
            $scope.categoryModalError = undefined;
            if (isEmpty(name)) {
                $scope.categoryModalError = 'Category name is required.';
            }
            else if (!isEdit && isNameTaken(name)) {
                $scope.categoryModalError = 'Category name already taken.';
            }
            else if (color === '#ffffff' || color === 'ffffff' || isEmpty(color)) {
                $scope.categoryModalError = 'Category color is required.';
            }
            return $scope.categoryModalError === undefined;
        }

        var isNameTaken = function(name) {
            var retVal = false;
            var cats = $rootScope.categories;;
            angular.forEach(cats, function(cat) {
                if (cat.label == name) {
                    retVal = true;
                }
            });
            return retVal;
        }

        return categoryManagement;
    }
}])

.factory('CategoryRESTService', function($resource) {
    return function(authHeader) {
        return {
            categories: $resource('http://api.stevedolan.me/events/:event_id/categories', {
                event_id: '@id'
            }, {
                get: {
                    method: 'GET',
                    headers: authHeader
                }
            }),
            new_category: $resource('http://api.stevedolan.me/events/:event_id/categories', {
                event_id: '@id'
            }, {
                create: {
                    method: 'POST',
                    headers: authHeader
                }
            }),
            category: $resource('http://api.stevedolan.me/categories/:id', {
                id: '@id'
            }, {
                get: {
                    method: 'GET',
                    headers: authHeader
                },
                update: {
                    method: 'PUT',
                    headers: authHeader
                },
                delete: {
                    method: 'DELETE',
                    headers: authHeader
                }
            })
        }
    }
})

.directive('cngDroppableCategory', ['$cookies', function($cookies) {

    var link = function(scope, elem, attrs) {
        elem.droppable({
            drop: function(event, ui) {
                var droppedTeam = ui.draggable;
                scope.itemId = droppedTeam.attr('teamId').trim();
                // TODO: make the draggables generic (perhaps in another module).
                scope.categoryId = event.target.getAttribute('category-id');
                //var alreadyExists = scope.checkCategory({categoryName: categoryName, teamId: teamId});
                scope.transferItemToCategory(scope.categoryId, scope.itemId);
                droppedTeam.goBack();
                if (/*!alreadyExists*/true) {
                    var categoryContainer = $(event.target).find('a');
                    performFlashAnimation(categoryContainer);
                    //scope.updateCategory({categoryId: categoryId, teamId: teamId});
                }
            }
        });

        var performFlashAnimation = function(categoryContainer) {
        var originalColor = categoryContainer.css('backgroundColor');
            categoryContainer.animate({
                backgroundColor: "#fff"
            }, 400);
            categoryContainer.animate({
                backgroundColor: originalColor
            }, 400);
        }

        var category = elem.find('.btn'), cog = elem.find('.glyphicon-cog');

        category.mouseenter(function() {
            cog.show();
        });

        category.mouseleave(function() {
            cog.hide();
        });
    }

    return {
        restrict: 'A',
        link: link
    }

}])

.directive('cngSpecialDroppableCategory', function() {

    var link = function(scope, elem, attrs) {
        elem.droppable({
            drop: function(event, ui) {
                var droppedTeam = ui.draggable;
                scope.itemId = droppedTeam.attr('teamId').trim();
                if ($(this).hasClass('destroy-special-category'))
                    scope.deleteTeam({itemId: scope.itemId});
                else if ($(this).hasClass('remove-special-category'))
                    
            }
        });
    }

    return {
        restrict: 'A',
        scope: {
            deleteTeam: '&deleteTeam',
            removeTeamFromCategory: '&removeTeamFromCategory'
        },
        link: link
    }

});